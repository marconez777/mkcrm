// audio-tick — cron 5 min.
// Transcreve áudios recebidos (needs_audio_transcription=true, transcript IS NULL)
// usando Whisper-1 com a chave BYOK da clínica. Grava transcript em messages
// e registra o run em lead_ai_extraction_runs (kind='audio').
//
// Salvaguardas:
//   - só clínicas com openai_status='configured'
//   - budget diário em minutos: daily_budget_audio_minutes
//   - registra erro com retry implícito (mantém needs_audio_transcription=true)
//   - quando der ok, dispara o trigger de leads via UPDATE de messages.transcript
//     (o trg_lead_needs_extraction não dispara em UPDATE — então marcamos lead
//     direto pra re-extração)
//
// Trigger via cron OU POST manual (force=true, clinic_id, message_ids).

import { corsHeaders, json, sb } from "../_shared/evolution.ts";

const WHISPER_PER_MINUTE_USD = 0.006;

interface ClinicCfg {
  daily_budget_audio_minutes: number;
  openai_status: string;
  openai_model_audio: string;
}

const DEFAULTS: ClinicCfg = {
  daily_budget_audio_minutes: 60,
  openai_status: "empty",
  openai_model_audio: "whisper-1",
};

function mergeCfg(raw: any): ClinicCfg {
  return { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
}

interface WhisperResp {
  text?: string;
  duration?: number;
  language?: string;
  error?: { message?: string };
}

async function downloadMedia(url: string): Promise<{ blob: Blob; mime: string } | { error: string }> {
  try {
    const r = await fetch(url);
    if (!r.ok) return { error: `download HTTP ${r.status}` };
    const blob = await r.blob();
    const mime = r.headers.get("content-type") ?? blob.type ?? "audio/ogg";
    return { blob, mime };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function filenameForMime(mime: string): string {
  if (mime.includes("ogg")) return "audio.ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "audio.mp3";
  if (mime.includes("wav")) return "audio.wav";
  if (mime.includes("m4a") || mime.includes("mp4")) return "audio.m4a";
  if (mime.includes("webm")) return "audio.webm";
  return "audio.ogg";
}

async function callWhisper(
  apiKey: string,
  model: string,
  blob: Blob,
  mime: string,
): Promise<{ ok: boolean; data?: WhisperResp; error?: string; status?: number }> {
  try {
    const fd = new FormData();
    fd.append("file", blob, filenameForMime(mime));
    fd.append("model", model);
    fd.append("language", "pt");
    fd.append("response_format", "verbose_json");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });
    const data = (await r.json()) as WhisperResp;
    if (!r.ok) {
      return { ok: false, status: r.status, error: data?.error?.message ?? `HTTP ${r.status}` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

interface MsgRow {
  id: string;
  lead_id: string;
  clinic_id: string;
  media_url: string | null;
  media_mime: string | null;
  message_type: string;
}

async function processClinic(clinicId: string, cfg: ClinicCfg, messageIds?: string[]) {
  const supabase = sb();

  const { data: keyData } = await supabase.rpc("get_openai_key", { _clinic_id: clinicId });
  const apiKey = typeof keyData === "string" ? keyData : null;
  if (!apiKey) return { clinic_id: clinicId, processed: 0, skipped: 0, error: "no_key" };

  // budget diário em minutos (somando duration aproximada via cost / per-minute)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: runsToday } = await supabase
    .from("lead_ai_extraction_runs")
    .select("cost_usd")
    .eq("clinic_id", clinicId)
    .eq("kind", "audio")
    .gte("created_at", since);
  const usedMinutes =
    (runsToday ?? []).reduce((s, r: any) => s + Number(r.cost_usd ?? 0), 0) / WHISPER_PER_MINUTE_USD;
  const remainingMinutes = Math.max(0, cfg.daily_budget_audio_minutes - usedMinutes);
  if (remainingMinutes <= 0) {
    return { clinic_id: clinicId, processed: 0, skipped: 0, error: "daily_budget_exhausted" };
  }

  // fila: até 20 áudios por ciclo (5min)
  const msgsQ = supabase
    .from("messages")
    .select("id, lead_id, clinic_id, media_url, media_mime, message_type")
    .eq("clinic_id", clinicId)
    .eq("needs_audio_transcription", true)
    .is("transcript", null)
    .not("media_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(20);
  if (messageIds?.length) msgsQ.in("id", messageIds);

  const { data: msgs, error: msgsErr } = await msgsQ;
  if (msgsErr) return { clinic_id: clinicId, error: msgsErr.message };
  if (!msgs || msgs.length === 0) return { clinic_id: clinicId, processed: 0, skipped: 0 };

  let processed = 0;
  let skipped = 0;
  let minutesLeft = remainingMinutes;
  const nowIso = new Date().toISOString();

  for (const m of msgs as MsgRow[]) {
    if (minutesLeft <= 0) {
      skipped++;
      continue;
    }
    if (!m.media_url) {
      await supabase.from("messages").update({
        needs_audio_transcription: false,
        transcript_status: "no_media",
      }).eq("id", m.id);
      skipped++;
      continue;
    }

    // marca processando
    await supabase.from("messages").update({ transcript_status: "processing" }).eq("id", m.id);

    const dl = await downloadMedia(m.media_url);
    if ("error" in dl) {
      await supabase.from("messages").update({
        transcript_status: "download_error",
        last_error: dl.error.slice(0, 240),
      }).eq("id", m.id);
      await supabase.from("lead_ai_extraction_runs").insert({
        clinic_id: clinicId,
        lead_id: m.lead_id,
        message_id: m.id,
        kind: "audio",
        model: cfg.openai_model_audio,
        error: dl.error.slice(0, 500),
      });
      skipped++;
      continue;
    }

    const w = await callWhisper(apiKey, cfg.openai_model_audio, dl.blob, dl.mime);
    if (!w.ok) {
      await supabase.from("messages").update({
        transcript_status: "error",
        last_error: w.error?.slice(0, 240) ?? "whisper error",
      }).eq("id", m.id);
      await supabase.from("lead_ai_extraction_runs").insert({
        clinic_id: clinicId,
        lead_id: m.lead_id,
        message_id: m.id,
        kind: "audio",
        model: cfg.openai_model_audio,
        error: w.error?.slice(0, 500),
      });
      if (w.status === 401) {
        await supabase
          .from("clinic_secrets")
          .update({
            openai_status: "invalid",
            openai_last_error: w.error?.slice(0, 240) ?? "401",
            openai_last_checked_at: nowIso,
          })
          .eq("clinic_id", clinicId);
        return { clinic_id: clinicId, processed, skipped, error: "invalid_key" };
      }
      skipped++;
      continue;
    }

    const transcript = (w.data?.text ?? "").trim();
    const durationSec = Number(w.data?.duration ?? 0);
    const minutes = durationSec > 0 ? durationSec / 60 : 0.25; // fallback 15s
    const cost = Math.round(minutes * WHISPER_PER_MINUTE_USD * 1_000_000) / 1_000_000;
    minutesLeft -= minutes;

    await supabase.from("messages").update({
      transcript,
      transcript_status: transcript ? "done" : "empty",
      transcript_cost_usd: cost,
      needs_audio_transcription: false,
    }).eq("id", m.id);

    await supabase.from("lead_ai_extraction_runs").insert({
      clinic_id: clinicId,
      lead_id: m.lead_id,
      message_id: m.id,
      kind: "audio",
      model: cfg.openai_model_audio,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: cost,
      fields_set: { transcript: transcript.slice(0, 240), duration_sec: durationSec },
      confidence: transcript ? 0.9 : 0.1,
    });

    if (transcript) {
      // Re-enfileira o lead pra o extractor-tick reprocessar com o novo texto
      await supabase
        .from("leads")
        .update({
          needs_ai_review: true,
          ai_review_queued_at: nowIso,
        })
        .eq("id", m.lead_id);

      await supabase.from("lead_events").insert({
        clinic_id: clinicId,
        lead_id: m.lead_id,
        type: "audio_transcribed",
        payload: {
          message_id: m.id,
          duration_sec: durationSec,
          cost_usd: cost,
          length: transcript.length,
        },
      });
    }

    processed++;
  }

  return { clinic_id: clinicId, processed, skipped };
}

interface Body {
  clinic_id?: string;
  message_ids?: string[];
  force?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* cron sem body */ }
  }

  const supabase = sb();

  let q = supabase
    .from("clinic_secrets")
    .select("clinic_id, openai_status, clinics:clinic_id(classifier_config)");
  if (body.clinic_id) q = q.eq("clinic_id", body.clinic_id);

  const { data: secrets, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const results: any[] = [];
  for (const s of (secrets ?? []) as any[]) {
    if (s.openai_status !== "configured" && !body.force) continue;
    const cfg = mergeCfg(s.clinics?.classifier_config);
    const r = await processClinic(s.clinic_id, cfg, body.message_ids);
    results.push(r);
  }

  return json({ ok: true, results });
});

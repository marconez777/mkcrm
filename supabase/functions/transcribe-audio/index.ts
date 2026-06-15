// Transcribes an audio message. Tries the clinic's own AI agent (OpenAI Whisper or Google Gemini)
// first, then falls back to Lovable AI Gateway (google/gemini-2.5-flash) if no agent is configured
// or the agent's API key is rejected (401/403/invalid_api_key).
// Always returns HTTP 200 with { ok, transcript?, error?, code?, source? } so the client can read it.
// Body: { message_id: string }
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

type Audio = { bytes: Uint8Array; mime: string };

async function fetchAudio(url: string): Promise<Audio | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = r.headers.get("content-type") ?? "audio/ogg";
    const bytes = new Uint8Array(await r.arrayBuffer());
    return { bytes, mime };
  } catch {
    return null;
  }
}

async function ensureFreshUrl(supabase: any, url: string): Promise<string> {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/storage\/v1\/object\/(sign|public)\/([^/]+)\/(.+)$/);
    if (!m) return url;
    const bucket = m[2];
    const path = decodeURIComponent(m[3]);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) return url;
    return data.signedUrl;
  } catch {
    return url;
  }
}

function bytesToBase64(buf: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + chunk) as any);
  }
  return btoa(bin);
}

function audioFormatFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("flac")) return "flac";
  return "ogg";
}

class AuthError extends Error {
  constructor(public provider: string, public status: number, public detail: string) {
    super(`${provider} ${status}: ${detail}`);
  }
}

async function transcribeOpenAI(apiKey: string, baseUrl: string | null, audio: Audio): Promise<string> {
  const base = (baseUrl?.replace(/\/+$/, "") || "https://api.openai.com/v1");
  const ext = audioFormatFromMime(audio.mime);
  const fd = new FormData();
  fd.append("file", new Blob([audio.bytes], { type: audio.mime }), `audio.${ext === "m4a" ? "m4a" : ext}`);
  fd.append("model", "whisper-1");
  fd.append("language", "pt");
  const r = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (r.status === 401 || r.status === 403) {
    throw new AuthError("openai", r.status, (await r.text()).slice(0, 300));
  }
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return data.text ?? "";
}

async function transcribeGoogle(apiKey: string, model: string, audio: Audio): Promise<string> {
  const m = model && model.startsWith("gemini") ? model : "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${apiKey}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: "Transcreva o áudio a seguir em português, fielmente. Retorne APENAS a transcrição." },
          { inline_data: { mime_type: audio.mime, data: bytesToBase64(audio.bytes) } },
        ],
      }],
    }),
  });
  if (r.status === 401 || r.status === 403) {
    throw new AuthError("google", r.status, (await r.text()).slice(0, 300));
  }
  if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p.text ?? "").join("").trim();
}

async function transcribeLovableGateway(audio: Audio): Promise<{ transcript: string; code?: string; error?: string }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { transcript: "", error: "LOVABLE_API_KEY ausente no projeto", code: "no_gateway_key" };
  const format = audioFormatFromMime(audio.mime);
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "edge-function",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcreva o áudio a seguir em português, fielmente. Retorne APENAS a transcrição, sem comentários." },
            { type: "input_audio", input_audio: { data: bytesToBase64(audio.bytes), format } },
          ],
        },
      ],
    }),
  });
  if (r.status === 429) return { transcript: "", error: "Limite de requisições do Lovable AI atingido — tente novamente em instantes.", code: "rate_limited" };
  if (r.status === 402) return { transcript: "", error: "Créditos do Lovable AI esgotados — adicione créditos em Configurações → Uso.", code: "credits_exhausted" };
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { transcript: "", error: `Lovable AI ${r.status}: ${t.slice(0, 200)}`, code: "gateway_error" };
  }
  const data = await r.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;
  const transcript = typeof text === "string" ? text.trim() : Array.isArray(text) ? text.map((p: any) => p.text ?? "").join("").trim() : "";
  if (!transcript) return { transcript: "", error: "Lovable AI não retornou transcrição.", code: "empty_response" };
  return { transcript };
}

async function logKeyInvalid(supabase: any, clinic_id: string, provider: string, apiKey: string, detail: string, lead_id?: string) {
  try {
    const masked = apiKey ? `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}` : null;
    await supabase.from("webhook_events").insert({
      event_type: "ai_key_invalid",
      source: "transcribe-audio",
      clinic_id,
      lead_id: lead_id ?? null,
      payload: { provider, key_prefix: masked, detail: detail.slice(0, 500) },
      error: detail.slice(0, 500),
    });
  } catch (_) { /* best-effort */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { message_id } = await req.json();
    if (!message_id) return json({ ok: false, error: "message_id required" }, 200);
    const supabase = sb();

    const { data: msg } = await supabase
      .from("messages")
      .select("id, media_url, raw, message_type, lead_id")
      .eq("id", message_id)
      .single();
    if (!msg) return json({ ok: false, error: "Mensagem não encontrada" }, 200);

    const cached = (msg.raw as any)?.transcript;
    if (cached) return json({ ok: true, transcript: cached, cached: true });
    if (!msg.media_url) return json({ ok: false, error: "Mensagem sem mídia para transcrever" }, 200);

    const { data: lead } = await supabase
      .from("leads").select("clinic_id").eq("id", (msg as any).lead_id).single();
    if (!lead?.clinic_id) return json({ ok: false, error: "Clínica não encontrada para a mensagem" }, 200);

    const freshUrl = await ensureFreshUrl(supabase, msg.media_url);
    const audio = await fetchAudio(freshUrl);
    if (!audio) return json({ ok: false, error: "Falha ao baixar áudio (URL inválida ou expirada)" }, 200);

    // 1) Try clinic agents (OpenAI/Google) with keys
    const { data: agents } = await supabase
      .from("ai_agents")
      .select("provider, api_key, base_url, model, role, enabled")
      .eq("clinic_id", lead.clinic_id)
      .eq("enabled", true);
    const list = ((agents ?? []) as any[]).filter((a) => typeof a.api_key === "string" && a.api_key.length > 0);
    const audioCapable = list.filter((a) => a.provider === "openai" || a.provider === "google");
    const chosen =
      audioCapable.find((a) => a.role === "summary") ??
      audioCapable[0] ??
      null;

    let transcript = "";
    let source: "openai" | "google" | "lovable-gateway" | null = null;
    let agentAuthFailed = false;

    if (chosen) {
      try {
        if (chosen.provider === "openai") {
          transcript = await transcribeOpenAI(chosen.api_key, chosen.base_url, audio);
          source = "openai";
        } else {
          transcript = await transcribeGoogle(chosen.api_key, chosen.model, audio);
          source = "google";
        }
      } catch (e) {
        if (e instanceof AuthError) {
          agentAuthFailed = true;
          await logKeyInvalid(supabase, lead.clinic_id, e.provider, chosen.api_key, e.detail, (msg as any).lead_id);
          console.warn("agent auth failed, will fallback to gateway", e.message);
        } else {
          console.warn("agent transcription failed, will fallback to gateway", String(e));
        }
      }
    }

    // 2) Fallback to Lovable AI Gateway
    if (!transcript) {
      const gw = await transcribeLovableGateway(audio);
      if (gw.transcript) {
        transcript = gw.transcript;
        source = "lovable-gateway";
      } else {
        const baseMsg = agentAuthFailed
          ? "Chave OpenAI da clínica foi rejeitada. Atualize em IA → Agentes. "
          : !chosen
            ? "Nenhum agente OpenAI/Google configurado e "
            : "";
        return json({
          ok: false,
          error: baseMsg + (gw.error ?? "fallback indisponível"),
          code: gw.code ?? (agentAuthFailed ? "agent_key_invalid" : "no_provider"),
        }, 200);
      }
    }

    const newRaw = { ...(msg.raw as any || {}), transcript, transcript_source: source };
    await supabase.from("messages").update({ raw: newRaw }).eq("id", message_id);
    return json({ ok: true, transcript, source });
  } catch (e) {
    console.error("transcribe-audio fatal", e);
    return json({ ok: false, error: String(e) }, 200);
  }
});

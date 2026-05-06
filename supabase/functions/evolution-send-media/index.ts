// Sends a media message (image/video/audio/document) via Evolution API.
import { corsHeaders, json, sb, loadInstance, evoFetch } from "../_shared/evolution.ts";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 2000, 5000];

type MediaKind = "image" | "video" | "audio" | "document";

function endpointFor(kind: MediaKind, instance: string) {
  if (kind === "audio") return `/message/sendWhatsAppAudio/${encodeURIComponent(instance)}`;
  return `/message/sendMedia/${encodeURIComponent(instance)}`;
}

function buildBody(kind: MediaKind, phone: string, mediaUrl: string, mime: string, fileName: string, caption: string, quotedId?: string | null) {
  const base: any = { number: phone };
  if (quotedId) base.quoted = { key: { id: quotedId } };
  if (kind === "audio") {
    base.audio = mediaUrl;
    return base;
  }
  base.mediatype = kind;
  base.mimetype = mime;
  base.media = mediaUrl;
  base.fileName = fileName;
  if (caption) base.caption = caption;
  return base;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const { lead_id, media_url, mime, filename, caption, media_kind, client_message_id, quoted_external_id } = await req.json();
    if (!lead_id || !media_url || !media_kind) {
      return json({ error: "lead_id, media_url and media_kind required" }, 400);
    }
    const kind = media_kind as MediaKind;
    if (!["image", "video", "audio", "document"].includes(kind)) {
      return json({ error: "invalid media_kind" }, 400);
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("phone, whatsapp_instance_id, clinic_id")
      .eq("id", lead_id)
      .single();
    if (!lead) return json({ error: "Lead não encontrado" }, 404);

    const instance = await loadInstance(lead.whatsapp_instance_id);
    if (!instance) return json({ error: "Nenhuma instância WhatsApp configurada" }, 400);

    const cid = client_message_id ?? crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const cap = (caption ?? "").toString();
    const fname = (filename ?? "arquivo").toString();
    const previewBase = cap || (kind === "image" ? "[Imagem]" : kind === "video" ? "[Vídeo]" : kind === "audio" ? "[Áudio]" : `[${fname}]`);

    let msgRow: { id: string } | null = null;
    if (client_message_id) {
      const { data: existing } = await supabase
        .from("messages")
        .select("id, status")
        .eq("client_message_id", client_message_id)
        .maybeSingle();
      if (existing) {
        if (existing.status === "sent") return json({ ok: true, deduped: true });
        msgRow = { id: existing.id };
      }
    }

    if (!msgRow) {
      const { data: inserted, error: insErr } = await supabase
        .from("messages")
        .insert({
          lead_id,
          client_message_id: cid,
          from_me: true,
          message_type: kind,
          content: cap || fname,
          media_url,
          media_mime: mime ?? null,
          status: "pending",
          timestamp: nowIso,
          reply_to_external_id: quoted_external_id ?? null,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      msgRow = inserted;
    }

    await supabase
      .from("leads")
      .update({
        last_message_at: nowIso,
        last_message_preview: previewBase.slice(0, 120),
        unread_count: 0,
      })
      .eq("id", lead_id);

    let lastErr: string | null = null;
    let result: any = null;
    let success = false;

    const path = endpointFor(kind, instance.evolution_instance);
    const body = buildBody(kind, lead.phone, media_url, mime ?? "application/octet-stream", fname, cap, quoted_external_id);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (BACKOFF_MS[attempt]) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      try {
        const resp = await evoFetch(instance, path, { method: "POST", body: JSON.stringify(body) });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok) {
          result = data;
          success = true;
          break;
        }
        lastErr = `HTTP ${resp.status}: ${JSON.stringify(data).slice(0, 300)}`;
        if (resp.status >= 400 && resp.status < 500 && resp.status !== 408 && resp.status !== 429) break;
      } catch (e) {
        lastErr = String(e);
      }
      await supabase
        .from("messages")
        .update({ retry_count: attempt + 1, last_error: lastErr })
        .eq("id", msgRow.id);
    }

    if (success) {
      const externalId = result?.key?.id ?? result?.messageId ?? null;
      await supabase
        .from("messages")
        .update({ status: "sent", external_id: externalId, raw: result, last_error: null })
        .eq("id", msgRow.id);
      return json({ ok: true, result });
    } else {
      await supabase
        .from("messages")
        .update({ status: "failed", last_error: lastErr })
        .eq("id", msgRow.id);
      return json({ error: "Falha ao enviar mídia", detail: lastErr }, 502);
    }
  } catch (err) {
    console.error("evolution-send-media error", err);
    return json({ error: String(err) }, 500);
  }
});

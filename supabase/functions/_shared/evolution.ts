// Shared helpers for Evolution API integration
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const sb = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

export type Settings = {
  evolution_url: string | null;
  evolution_api_key: string | null;
  evolution_instance: string | null;
  webhook_token: string;
};

export async function loadSettings() {
  const supabase = sb();
  const { data } = await supabase
    .from("settings")
    .select("evolution_url, evolution_api_key, evolution_instance, webhook_token")
    .eq("id", 1)
    .single();
  return data as Settings | null;
}

export function evoBase(url: string) {
  return url.replace(/\/$/, "");
}

export async function evoFetch(
  settings: Settings,
  path: string,
  init: RequestInit = {},
) {
  const url = `${evoBase(settings.evolution_url!)}${path}`;
  const headers = {
    "Content-Type": "application/json",
    apikey: settings.evolution_api_key!,
    ...(init.headers ?? {}),
  };
  return fetch(url, { ...init, headers });
}

export function phoneFromJid(jid: string | undefined | null): string | null {
  if (!jid) return null;
  if (jid.includes("@g.us")) return null;
  return jid.split("@")[0].replace(/\D/g, "");
}

export function extractText(msg: any): { type: string; content: string | null } {
  if (!msg) return { type: "unknown", content: null };
  if (msg.conversation) return { type: "text", content: msg.conversation };
  if (msg.extendedTextMessage?.text)
    return { type: "text", content: msg.extendedTextMessage.text };
  if (msg.imageMessage)
    return { type: "image", content: msg.imageMessage.caption || "[Imagem]" };
  if (msg.videoMessage)
    return { type: "video", content: msg.videoMessage.caption || "[Vídeo]" };
  if (msg.audioMessage) return { type: "audio", content: "[Áudio]" };
  if (msg.documentMessage)
    return {
      type: "document",
      content: msg.documentMessage.fileName || "[Documento]",
    };
  if (msg.stickerMessage) return { type: "sticker", content: "[Figurinha]" };
  return { type: "unknown", content: null };
}

export const REQUIRED_EVENTS = [
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "CONTACTS_UPSERT",
  "CONNECTION_UPDATE",
];

/**
 * Ingest a single Evolution message item into the database.
 * Idempotent — relies on unique indexes on (lead_id, external_id) and client_message_id.
 * Used by both the realtime webhook and the polling reconciler.
 */
export async function ingestMessage(item: any, source: "webhook" | "poll" | "sync") {
  const supabase = sb();
  const remoteJid = item?.key?.remoteJid;
  const phone = phoneFromJid(remoteJid);
  if (!phone) return { skipped: true, reason: "no-phone" };

  const fromMe = !!item?.key?.fromMe;
  const externalId: string | null = item?.key?.id ?? null;
  const { type, content } = extractText(item.message);
  // Reply context (quoted message)
  const ctx = item?.message?.extendedTextMessage?.contextInfo
    ?? item?.message?.imageMessage?.contextInfo
    ?? item?.message?.videoMessage?.contextInfo
    ?? item?.contextInfo;
  const replyToExternalId: string | null = ctx?.stanzaId ?? null;
  const pushName = item?.pushName ?? null;
  const ts = item?.messageTimestamp
    ? new Date(Number(item.messageTimestamp) * 1000).toISOString()
    : new Date().toISOString();

  // Find or create lead
  let { data: lead } = await supabase
    .from("leads")
    .select("id, name")
    .eq("phone", phone)
    .maybeSingle();

  if (!lead) {
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .order("position")
      .limit(1)
      .single();
    const { data: created, error } = await supabase
      .from("leads")
      .insert({
        phone,
        name: pushName,
        stage_id: stage?.id ?? null,
        last_message_at: ts,
        last_message_preview: content?.slice(0, 120) ?? null,
        unread_count: fromMe ? 0 : 1,
      })
      .select("id, name")
      .single();
    if (error) throw error;
    lead = created;
  } else {
    if (pushName && !(lead as any).name) {
      await supabase.from("leads").update({ name: pushName }).eq("id", lead.id);
    }
    if (!fromMe) {
      // Atomic increment + preview update via RPC
      await supabase.rpc("increment_unread", {
        p_lead_id: lead.id,
        p_preview: content?.slice(0, 120) ?? null,
        p_ts: ts,
      });
    } else {
      await supabase
        .from("leads")
        .update({
          last_message_at: ts,
          last_message_preview: content?.slice(0, 120) ?? null,
        })
        .eq("id", lead.id);
    }
  }

  // Upsert message — unique index handles dedup across webhook + poll
  const { error: upErr } = await supabase
    .from("messages")
    .upsert(
      {
        lead_id: lead!.id,
        external_id: externalId,
        from_me: fromMe,
        message_type: type,
        content,
        timestamp: ts,
        raw: item,
        reply_to_external_id: replyToExternalId,
        status: item?.status ? String(item.status).toLowerCase() : (fromMe ? "sent" : "received"),
      },
      { onConflict: "lead_id,external_id", ignoreDuplicates: false },
    );
  if (upErr) throw upErr;

  return { lead_id: lead!.id, external_id: externalId, source };
}

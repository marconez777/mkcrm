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
export async function ingestMessage(
  item: any,
  source: "webhook" | "poll" | "sync",
  opts: { silent?: boolean } = {},
) {
  const supabase = sb();
  const silent = !!opts.silent;
  const remoteJid = item?.key?.remoteJid;
  const phone = phoneFromJid(remoteJid);
  if (!phone) return { skipped: true, reason: "no-phone" };

  const fromMe = !!item?.key?.fromMe;
  const externalId: string | null = item?.key?.id ?? null;
  const { type, content } = extractText(item.message);
  const ctx = item?.message?.extendedTextMessage?.contextInfo
    ?? item?.message?.imageMessage?.contextInfo
    ?? item?.message?.videoMessage?.contextInfo
    ?? item?.contextInfo;
  const replyToExternalId: string | null = ctx?.stanzaId ?? null;
  const pushName = item?.pushName ?? null;
  const ts = item?.messageTimestamp
    ? new Date(Number(item.messageTimestamp) * 1000).toISOString()
    : new Date().toISOString();
  const newStatus = item?.status ? String(item.status).toLowerCase() : (fromMe ? "sent" : "received");

  // Find or create lead
  let { data: lead } = await supabase
    .from("leads")
    .select("id, name")
    .eq("phone", phone)
    .maybeSingle();

  let createdLead = false;
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
        unread_count: fromMe || silent ? 0 : 1,
      })
      .select("id, name")
      .single();
    if (error) throw error;
    lead = created;
    createdLead = true;
  } else if (pushName && !(lead as any).name) {
    await supabase.from("leads").update({ name: pushName }).eq("id", lead.id);
  }

  // Idempotency check on existing message
  let existing: any = null;
  if (externalId) {
    const { data } = await supabase
      .from("messages")
      .select("id, content, status, reply_to_external_id, message_type")
      .eq("lead_id", lead!.id)
      .eq("external_id", externalId)
      .maybeSingle();
    existing = data;
  }

  let isNewMessage = false;
  if (existing) {
    // Only update if a relevant field actually changed — avoids realtime ping-pong
    const changed =
      existing.content !== content ||
      existing.status !== newStatus ||
      existing.reply_to_external_id !== replyToExternalId ||
      existing.message_type !== type;
    if (changed) {
      const { error: updErr } = await supabase
        .from("messages")
        .update({
          content,
          message_type: type,
          status: newStatus,
          reply_to_external_id: replyToExternalId,
        })
        .eq("id", existing.id);
      if (updErr) throw updErr;
    }
  } else {
    const { error: insErr } = await supabase.from("messages").insert({
      lead_id: lead!.id,
      external_id: externalId,
      from_me: fromMe,
      message_type: type,
      content,
      timestamp: ts,
      raw: item,
      reply_to_external_id: replyToExternalId,
      status: newStatus,
    });
    if (insErr) {
      // Race: unique violation — treat as already ingested
      if (!String(insErr.message ?? "").toLowerCase().includes("duplicate")) throw insErr;
    } else {
      isNewMessage = true;
    }
  }

  // Lead counters: only mutate when a brand-new message arrived
  if (isNewMessage && !createdLead) {
    if (!fromMe && !silent) {
      await supabase.rpc("increment_unread", {
        p_lead_id: lead!.id,
        p_preview: content?.slice(0, 120) ?? null,
        p_ts: ts,
      });
    } else if (!silent) {
      await supabase
        .from("leads")
        .update({
          last_message_at: ts,
          last_message_preview: content?.slice(0, 120) ?? null,
        })
        .eq("id", lead!.id);
    }
  }

  return { lead_id: lead!.id, external_id: externalId, source, isNew: isNewMessage };
}

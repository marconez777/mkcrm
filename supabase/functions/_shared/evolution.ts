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

export type Instance = {
  id: string;
  name: string;
  evolution_url: string;
  evolution_api_key: string;
  evolution_instance: string;
  webhook_token: string;
  is_default?: boolean;
};

/** Load a specific instance by id, or the default one if not provided. */
export async function loadInstance(instanceId?: string | null): Promise<Instance | null> {
  const supabase = sb();
  if (instanceId) {
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instanceId)
      .maybeSingle();
    if (data) return data as Instance;
  }
  const { data } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("is_default", true)
    .maybeSingle();
  return (data as Instance) ?? null;
}

/** Load instance by webhook token (used by webhook handler). */
export async function loadInstanceByToken(token: string): Promise<Instance | null> {
  const supabase = sb();
  const { data } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("webhook_token", token)
    .maybeSingle();
  return (data as Instance) ?? null;
}

/** Load all configured instances (for health watchdog). */
export async function loadAllInstances(): Promise<Instance[]> {
  const supabase = sb();
  const { data } = await supabase.from("whatsapp_instances").select("*");
  return (data as Instance[]) ?? [];
}

export function evoBase(url: string) {
  return url.replace(/\/$/, "");
}

export async function evoFetch(
  instance: Instance,
  path: string,
  init: RequestInit = {},
) {
  const url = `${evoBase(instance.evolution_url)}${path}`;
  const headers = {
    "Content-Type": "application/json",
    apikey: instance.evolution_api_key,
    ...(init.headers ?? {}),
  };
  return fetch(url, { ...init, headers });
}

function digitsFromJid(jid: string | undefined | null): string | null {
  if (!jid) return null;
  if (jid.includes("@g.us")) return null;
  const phone = jid.split("@")[0].replace(/\D/g, "");
  if (phone.length < 8 || phone.length > 15) return null;
  return phone;
}

/**
 * Resolve telefone real a partir do objeto `key` da Evolution.
 * O WhatsApp Multi-Device entrega `remoteJid` como LID (ex: "222041840046305@lid")
 * e o telefone verdadeiro vem em `remoteJidAlt` (ex: "5511915142236@s.whatsapp.net").
 */
export function phoneFromKey(key: any): string | null {
  if (!key) return null;
  const remoteJid: string | undefined = key.remoteJid;
  const remoteJidAlt: string | undefined = key.remoteJidAlt;
  const isLid = key.addressingMode === "lid" || (typeof remoteJid === "string" && remoteJid.includes("@lid"));
  if (isLid) {
    // tenta primeiro o alt (telefone real); se não houver, descarta para evitar duplicata
    return digitsFromJid(remoteJidAlt) ?? null;
  }
  return digitsFromJid(remoteJid) ?? digitsFromJid(remoteJidAlt);
}

/** @deprecated use phoneFromKey */
export function phoneFromJid(jid: string | undefined | null): string | null {
  if (!jid) return null;
  if (jid.includes("@lid")) return null; // sem alt, não dá para resolver
  return digitsFromJid(jid);
}

/** Resolve telefone a partir de payload de contato (CONTACTS_UPSERT). */
export function phoneFromContact(it: any): string | null {
  return (
    digitsFromJid(it?.remoteJidAlt) ??
    phoneFromKey({ remoteJid: it?.id, remoteJidAlt: it?.remoteJidAlt, addressingMode: it?.addressingMode }) ??
    digitsFromJid(it?.id) ??
    digitsFromJid(it?.remoteJid)
  );
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
 * `instanceId` ties new leads to the WhatsApp instance that produced the event.
 */
export async function ingestMessage(
  item: any,
  source: "webhook" | "poll" | "sync",
  opts: { silent?: boolean; instanceId?: string | null } = {},
) {
  const supabase = sb();
  const silent = !!opts.silent;
  const instanceId = opts.instanceId ?? null;
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

  let { data: lead } = await supabase
    .from("leads")
    .select("id, name, whatsapp_instance_id")
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
        whatsapp_instance_id: instanceId,
        last_message_at: ts,
        last_message_preview: content?.slice(0, 120) ?? null,
        unread_count: fromMe || silent ? 0 : 1,
      })
      .select("id, name, whatsapp_instance_id")
      .single();
    if (error) throw error;
    lead = created;
    createdLead = true;
  } else {
    const patch: Record<string, unknown> = {};
    if (pushName && !(lead as any).name) patch.name = pushName;
    if (instanceId && !(lead as any).whatsapp_instance_id) patch.whatsapp_instance_id = instanceId;
    if (Object.keys(patch).length > 0) {
      await supabase.from("leads").update(patch).eq("id", lead.id);
    }
  }

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
      if (!String(insErr.message ?? "").toLowerCase().includes("duplicate")) throw insErr;
    } else {
      isNewMessage = true;
    }
  }

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

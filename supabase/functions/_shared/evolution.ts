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

/**
 * Validate the caller's JWT. Returns the user id, or a Response if unauthorized.
 * Also accepts the service role key (for internal cron / function-to-function calls).
 */
export async function requireUser(req: Request): Promise<string | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRole && token === serviceRole) return "service_role";

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return json({ error: "Unauthorized" }, 401);
    return data.user.id;
  } catch {
    return json({ error: "Unauthorized" }, 401);
  }
}

export type Instance = {
  id: string;
  name: string;
  evolution_url: string;
  evolution_api_key: string;
  evolution_instance: string;
  webhook_token: string;
  is_default?: boolean;
  clinic_id: string;
  last_inbound_webhook_at?: string | null;
  last_auto_restart_at?: string | null;
  auto_restart_count?: number | null;
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

export function extractText(msg: any): { type: string; content: string | null; mime?: string | null; fileName?: string | null } {
  if (!msg) return { type: "unknown", content: null };
  if (msg.conversation) return { type: "text", content: msg.conversation };
  if (msg.extendedTextMessage?.text)
    return { type: "text", content: msg.extendedTextMessage.text };
  // NOTE: campos `url` em imageMessage/videoMessage/etc são URLs CRIPTOGRAFADAS do WhatsApp
  // (mmg.whatsapp.net) e não podem ser baixadas diretamente — sempre passar por downloadAndStoreMedia.
  if (msg.imageMessage)
    return { type: "image", content: msg.imageMessage.caption || "[Imagem]", mime: msg.imageMessage.mimetype ?? "image/jpeg" };
  if (msg.videoMessage)
    return { type: "video", content: msg.videoMessage.caption || "[Vídeo]", mime: msg.videoMessage.mimetype ?? "video/mp4" };
  if (msg.audioMessage)
    return { type: "audio", content: "[Áudio]", mime: msg.audioMessage.mimetype ?? "audio/ogg" };
  if (msg.documentMessage)
    return {
      type: "document",
      content: msg.documentMessage.fileName || "[Documento]",
      mime: msg.documentMessage.mimetype ?? "application/octet-stream",
      fileName: msg.documentMessage.fileName ?? null,
    };
  if (msg.stickerMessage)
    return { type: "sticker", content: "[Figurinha]", mime: msg.stickerMessage.mimetype ?? "image/webp" };
  return { type: "unknown", content: null };
}

const MEDIA_BUCKET = "chat-attachments";
const MEDIA_TYPES = new Set(["image", "video", "audio", "document", "sticker"]);

export function isMediaType(type: string): boolean {
  return MEDIA_TYPES.has(type);
}

function extFromMime(mime: string, fallback = "bin"): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/3gpp": "3gp", "video/quicktime": "mov",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/webm": "webm",
    "application/pdf": "pdf", "application/zip": "zip",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  if (map[mime]) return map[mime];
  const m = mime.split("/")[1]?.split(";")[0];
  return m || fallback;
}

/** Download a media message via Evolution and upload to Storage. Updates the row with media_url/media_mime. */
export async function downloadAndStoreMedia(messageId: string, instance: Instance, item: any): Promise<void> {
  const supabase = sb();
  try {
    const resp = await evoFetch(instance, `/chat/getBase64FromMediaMessage/${encodeURIComponent(instance.evolution_instance)}`, {
      method: "POST",
      body: JSON.stringify({ message: { key: item.key, message: item.message }, convertToMp4: false }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("getBase64FromMediaMessage failed", resp.status, t.slice(0, 200));
      return;
    }
    const data = await resp.json().catch(() => null);
    const b64: string | undefined = data?.base64 ?? data?.media?.base64 ?? data?.data;
    if (!b64) {
      console.error("no base64 in evolution response");
      return;
    }
    const mime: string = data?.mimetype ?? data?.mediaType ?? "application/octet-stream";
    const fileName: string | undefined = data?.fileName;

    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const ext = fileName?.includes(".") ? fileName.split(".").pop()! : extFromMime(mime);
    const externalId = item?.key?.id ?? messageId;
    const path = `${messageId}/${externalId}.${ext}`;

    const up = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (up.error) {
      console.error("storage upload error", up.error.message);
      return;
    }
    const { data: signed } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    await supabase
      .from("messages")
      .update({ media_url: signed?.signedUrl ?? null, media_mime: mime })
      .eq("id", messageId);
  } catch (e) {
    console.error("downloadAndStoreMedia error", e);
  }
}


export const REQUIRED_EVENTS = [
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES_SET",
  "MESSAGING_HISTORY_SET",
  "CHATS_UPSERT",
  "CHATS_SET",
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
  const phone = phoneFromKey(item?.key);
  if (!phone) return { skipped: true, reason: "no-phone" };

  // Resolve clinic_id from instance (service role bypasses RLS, so default current_clinic_id() = NULL).
  let clinicId: string | null = null;
  if (instanceId) {
    const { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("clinic_id")
      .eq("id", instanceId)
      .maybeSingle();
    clinicId = (inst as any)?.clinic_id ?? null;
  }
  if (!clinicId) {
    const { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("clinic_id")
      .eq("is_default", true)
      .maybeSingle();
    clinicId = (inst as any)?.clinic_id ?? null;
  }
  if (!clinicId) return { skipped: true, reason: "no-clinic" };

  const fromMe = !!item?.key?.fromMe;
  const externalId: string | null = item?.key?.id ?? null;
  const { type, content } = extractText(item.message);
  const ctx = item?.message?.extendedTextMessage?.contextInfo
    ?? item?.message?.imageMessage?.contextInfo
    ?? item?.message?.videoMessage?.contextInfo
    ?? item?.contextInfo;
  const replyToExternalId: string | null = ctx?.stanzaId ?? null;
  // pushName em mensagens fromMe é o NOME DO PRÓPRIO USUÁRIO do WhatsApp,
  // NÃO o nome do contato. Só usar pushName quando a mensagem é recebida (fromMe = false).
  const pushName = !fromMe ? (item?.pushName ?? null) : null;
  const ts = item?.messageTimestamp
    ? new Date(Number(item.messageTimestamp) * 1000).toISOString()
    : new Date().toISOString();
  const newStatus = item?.status ? String(item.status).toLowerCase() : (fromMe ? "sent" : "received");

  let { data: lead } = await supabase
    .from("leads")
    .select("id, name, whatsapp_instance_id")
    .eq("phone", phone)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  let createdLead = false;
  if (!lead) {
    // Resolve funil de entrada: prioriza funil de vendas vinculado a esta instância.
    // Fallback: primeiro funil de vendas da clínica (default → menor position → mais antigo).
    let pipelineId: string | null = null;
    let pipelineFallback = false;
    if (instanceId) {
      const { data: pipe } = await supabase
        .from("pipelines")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("kind", "sales")
        .eq("whatsapp_instance_id", instanceId)
        .maybeSingle();
      pipelineId = (pipe as any)?.id ?? null;
    }
    if (!pipelineId) {
      const { data: fallbackPipe } = await supabase
        .from("pipelines")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("kind", "sales")
        .order("is_default", { ascending: false })
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      pipelineId = (fallbackPipe as any)?.id ?? null;
      if (pipelineId) {
        pipelineFallback = true;
        console.log("[ingestMessage] using fallback pipeline", { clinicId, instanceId, pipelineId });
      }
    }
    if (!pipelineId) {
      return { skipped: true, reason: "no-inbound-pipeline" };
    }
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .order("position")
      .limit(1)
      .maybeSingle();
    const { data: created, error } = await supabase
      .from("leads")
      .insert({
        phone,
        name: pushName,
        clinic_id: clinicId,
        stage_id: stage?.id ?? null,
        pipeline_id: pipelineId,
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
    if (pipelineFallback) {
      try {
        await supabase.from("lead_events").insert({
          lead_id: lead!.id,
          clinic_id: clinicId,
          type: "pipeline_fallback_used",
          payload: { instance_id: instanceId, pipeline_id: pipelineId },
        });
      } catch (_) { /* non-fatal */ }
    }
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
      .select("id, content, status, reply_to_external_id, message_type, media_url")
      .eq("lead_id", lead!.id)
      .eq("external_id", externalId)
      .maybeSingle();
    existing = data;
  }

  // URLs em imageMessage.url etc são criptografadas pelo WhatsApp — sempre baixar via downloadAndStoreMedia.


  let isNewMessage = false;
  let messageId: string | null = existing?.id ?? null;
  const existingNeedsMedia = !!existing && !existing.media_url && isMediaType(type);
  if (existing) {
    const changed =
      existing.content !== content ||
      existing.status !== newStatus ||
      existing.reply_to_external_id !== replyToExternalId ||
      existing.message_type !== type;
    if (changed) {
      const patch: Record<string, unknown> = {
        content,
        message_type: type,
        status: newStatus,
        reply_to_external_id: replyToExternalId,
      };
      const { error: updErr } = await supabase
        .from("messages")
        .update(patch)
        .eq("id", existing.id);
      if (updErr) throw updErr;
    }
  } else {
    const insertRow: Record<string, unknown> = {
      lead_id: lead!.id,
      clinic_id: clinicId,
      external_id: externalId,
      from_me: fromMe,
      message_type: type,
      content,
      timestamp: ts,
      raw: item,
      reply_to_external_id: replyToExternalId,
      status: newStatus,
    };
    const { data: inserted, error: insErr } = await supabase
      .from("messages")
      .insert(insertRow)
      .select("id")
      .maybeSingle();
    if (insErr) {
      if (!String(insErr.message ?? "").toLowerCase().includes("duplicate")) throw insErr;
    } else {
      isNewMessage = true;
      messageId = inserted?.id ?? null;
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

  return { lead_id: lead!.id, external_id: externalId, source, isNew: isNewMessage, message_id: messageId, type, needs_media: isMediaType(type) && (isNewMessage || existingNeedsMedia) };
}

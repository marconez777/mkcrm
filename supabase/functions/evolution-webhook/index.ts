// Receives events from Evolution API and stores messages/leads
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function phoneFromJid(jid: string | undefined | null): string | null {
  if (!jid) return null;
  // 5511999999999@s.whatsapp.net  or group@g.us  -> ignore groups
  if (jid.includes("@g.us")) return null;
  return jid.split("@")[0].replace(/\D/g, "");
}

function extractText(msg: any): { type: string; content: string | null } {
  if (!msg) return { type: "unknown", content: null };
  if (msg.conversation) return { type: "text", content: msg.conversation };
  if (msg.extendedTextMessage?.text) return { type: "text", content: msg.extendedTextMessage.text };
  if (msg.imageMessage) return { type: "image", content: msg.imageMessage.caption || "[Imagem]" };
  if (msg.videoMessage) return { type: "video", content: msg.videoMessage.caption || "[Vídeo]" };
  if (msg.audioMessage) return { type: "audio", content: "[Áudio]" };
  if (msg.documentMessage) return { type: "document", content: msg.documentMessage.fileName || "[Documento]" };
  if (msg.stickerMessage) return { type: "sticker", content: "[Figurinha]" };
  return { type: "unknown", content: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const { data: settings } = await supabase.from("settings").select("webhook_token").eq("id", 1).single();
    if (!settings || token !== settings.webhook_token) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const event: string = body.event || "";
    console.log("Evolution event:", event);

    // Normalize: Evolution can send single or batched data
    const items = Array.isArray(body.data) ? body.data : [body.data];

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      for (const it of items) {
        const remoteJid = it?.key?.remoteJid;
        const phone = phoneFromJid(remoteJid);
        if (!phone) continue;
        const fromMe = !!it?.key?.fromMe;
        const externalId = it?.key?.id ?? null;
        const { type, content } = extractText(it.message);
        const pushName = it?.pushName ?? null;
        const ts = it?.messageTimestamp ? new Date(Number(it.messageTimestamp) * 1000).toISOString() : new Date().toISOString();

        // Upsert lead
        let { data: lead } = await supabase.from("leads").select("id, name").eq("phone", phone).maybeSingle();
        if (!lead) {
          const { data: stage } = await supabase.from("pipeline_stages").select("id").order("position").limit(1).single();
          const { data: created } = await supabase.from("leads").insert({
            phone,
            name: pushName,
            stage_id: stage?.id ?? null,
            last_message_at: ts,
            last_message_preview: content?.slice(0, 120) ?? null,
            unread_count: fromMe ? 0 : 1,
          }).select("id").single();
          lead = created as any;
        } else {
          await supabase.from("leads").update({
            name: pushName ?? (lead as any).name ?? null,
            last_message_at: ts,
            last_message_preview: content?.slice(0, 120) ?? null,
            unread_count: fromMe ? 0 : (await supabase.rpc as any) && undefined as any,
          }).eq("id", lead.id);
          if (!fromMe) {
            // increment unread
            await supabase.from("leads").update({ unread_count: ((await supabase.from("leads").select("unread_count").eq("id", lead.id).single()).data?.unread_count ?? 0) + 1 }).eq("id", lead.id);
          }
        }

        if (lead) {
          await supabase.from("messages").upsert({
            lead_id: lead.id,
            external_id: externalId,
            from_me: fromMe,
            message_type: type,
            content,
            timestamp: ts,
            raw: it,
            status: it?.status ?? "received",
          }, { onConflict: "lead_id,external_id" });
        }
      }
    } else if (event === "messages.update" || event === "MESSAGES_UPDATE") {
      for (const it of items) {
        const externalId = it?.key?.id;
        const status = it?.status ?? it?.update?.status;
        if (externalId && status) {
          await supabase.from("messages").update({ status: String(status).toLowerCase() }).eq("external_id", externalId);
        }
      }
    } else if (event === "contacts.upsert" || event === "CONTACTS_UPSERT") {
      for (const it of items) {
        const phone = phoneFromJid(it?.id ?? it?.remoteJid);
        if (!phone) continue;
        const name = it?.pushName ?? it?.name ?? null;
        const avatar = it?.profilePicUrl ?? null;
        await supabase.from("leads").update({ name, avatar_url: avatar }).eq("phone", phone);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("webhook error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

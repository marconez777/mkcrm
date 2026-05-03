// Receives events from Evolution API. Logs every event for audit, then ingests.
import { corsHeaders, json, sb, ingestMessage, phoneFromJid, loadInstanceByToken } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = sb();
  const startedAt = Date.now();
  let auditId: string | null = null;
  let body: any = null;
  let eventType = "unknown";

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const instance = await loadInstanceByToken(token);
    if (!instance) {
      return json({ error: "Invalid token" }, 401);
    }

    body = await req.json();
    eventType = String(body.event || "unknown").toUpperCase().replace(/\./g, "_");

    const { data: audit } = await supabase
      .from("webhook_events")
      .insert({ event_type: eventType, payload: body, source: "webhook" })
      .select("id")
      .single();
    auditId = audit?.id ?? null;

    const items = Array.isArray(body.data) ? body.data : [body.data];
    let leadIdForAudit: string | null = null;

    if (eventType === "MESSAGES_UPSERT") {
      for (const it of items) {
        try {
          const res = await ingestMessage(it, "webhook", { instanceId: instance.id });
          if ("lead_id" in res) {
            leadIdForAudit = res.lead_id;
            // Fire-and-forget auto-reply only for genuinely new inbound messages
            if ((res as any).isNew && !it?.key?.fromMe) {
              const triggerAutoReply = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-auto-reply`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
                },
                body: JSON.stringify({ lead_id: res.lead_id }),
              }).catch((e) => console.error("auto-reply trigger failed", e));
              // @ts-ignore EdgeRuntime is available in Deno deploy
              if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(triggerAutoReply);
            }
          }
        } catch (e) {
          console.error("ingest error", e);
        }
      }
    } else if (eventType === "MESSAGES_UPDATE") {
      for (const it of items) {
        const externalId = it?.key?.id;
        const status = it?.status ?? it?.update?.status;
        if (externalId && status) {
          await supabase
            .from("messages")
            .update({ delivery_status: String(status).toLowerCase() })
            .eq("external_id", externalId);
        }
      }
    } else if (eventType === "CONTACTS_UPSERT") {
      for (const it of items) {
        const phone = phoneFromJid(it?.id ?? it?.remoteJid);
        if (!phone) continue;
        const name = it?.pushName ?? it?.name ?? null;
        const avatar = it?.profilePicUrl ?? null;
        await supabase
          .from("leads")
          .update({ name, avatar_url: avatar })
          .eq("phone", phone);
      }
    } else if (eventType === "CONNECTION_UPDATE") {
      const state = items[0]?.state ?? body.data?.state;
      if (state) {
        await supabase
          .from("whatsapp_instances")
          .update({ connection_state: String(state) })
          .eq("id", instance.id);
      }
    }

    if (auditId) {
      await supabase
        .from("webhook_events")
        .update({ processed_at: new Date().toISOString(), lead_id: leadIdForAudit })
        .eq("id", auditId);
    }

    console.log(JSON.stringify({ event: eventType, ms: Date.now() - startedAt, ok: true }));
    return json({ ok: true });
  } catch (err) {
    console.error("webhook error", err);
    if (auditId) {
      await supabase
        .from("webhook_events")
        .update({ error: String(err), processed_at: new Date().toISOString() })
        .eq("id", auditId);
    }
    return json({ error: String(err) }, 500);
  }
});

// Receives events from Evolution API. Logs every event for audit, then ingests.
import { corsHeaders, json, sb, ingestMessage, phoneFromContact, loadInstanceByToken, downloadAndStoreMedia } from "../_shared/evolution.ts";

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
            // Background: fetch media binary if needed
            if ((res as any).isNew && (res as any).needs_media && (res as any).message_id) {
              const mediaTask = downloadAndStoreMedia((res as any).message_id, instance, it);
              // @ts-ignore
              if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(mediaTask);
              else mediaTask.catch((e) => console.error("media task failed", e));
            }
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
      const RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
      const normalize = (s: string): string => {
        const u = s.toUpperCase();
        if (u === "SERVER_ACK" || u === "PENDING") return "sent";
        if (u === "DELIVERY_ACK" || u === "DELIVERED") return "delivered";
        if (u === "READ" || u === "PLAYED") return "read";
        return s.toLowerCase();
      };
      for (const it of items) {
        const externalId = it?.key?.id ?? it?.keyId ?? it?.messageId;
        const rawStatus = it?.status ?? it?.update?.status;
        if (!externalId || !rawStatus) continue;
        const newStatus = normalize(String(rawStatus));
        const { data: cur } = await supabase
          .from("messages")
          .select("id, delivery_status")
          .eq("external_id", externalId)
          .maybeSingle();
        if (!cur) continue;
        const curRank = RANK[(cur.delivery_status ?? "").toLowerCase()] ?? 0;
        const newRank = RANK[newStatus] ?? 0;
        if (newRank > curRank) {
          await supabase
            .from("messages")
            .update({ delivery_status: newStatus })
            .eq("id", cur.id);
        }
      }
    } else if (eventType === "CONTACTS_UPSERT") {
      for (const it of items) {
        const phone = phoneFromContact(it);
        if (!phone) continue;
        const name = it?.pushName ?? it?.name ?? null;
        const avatar = it?.profilePicUrl ?? null;
        const patch: Record<string, unknown> = {};
        if (name) patch.name = name;
        if (avatar) patch.avatar_url = avatar;
        if (Object.keys(patch).length === 0) continue;
        await supabase
          .from("leads")
          .update(patch)
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

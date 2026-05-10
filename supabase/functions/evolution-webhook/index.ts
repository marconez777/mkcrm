// Receives events from Evolution API. Logs every event for audit, then ingests.
import { corsHeaders, json, sb, ingestMessage, phoneFromContact, loadInstanceByToken, downloadAndStoreMedia } from "../_shared/evolution.ts";
import { isWebhookDuplicate } from "../_shared/utils.ts";

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

    // Dedupe at the event-level. Prevents Evolution retries from double-processing.
    // Hash on event + instance + first item key.id (or full body sample).
    const items = Array.isArray(body.data) ? body.data : [body.data];
    const dedupKey = `${eventType}::${instance.id}::${items[0]?.key?.id ?? ""}::${items[0]?.messageTimestamp ?? items[0]?.status ?? ""}`;
    if (dedupKey && (await isWebhookDuplicate(supabase, dedupKey))) {
      return json({ ok: true, deduped: true });
    }

    const { data: audit } = await supabase
      .from("webhook_events")
      .insert({ event_type: eventType, payload: body, source: "webhook" })
      .select("id")
      .single();
    auditId = audit?.id ?? null;

    let leadIdForAudit: string | null = null;

    if (eventType === "MESSAGES_UPSERT") {
      const settled = await Promise.allSettled(items.map((it: any) => ingestMessage(it, "webhook", { instanceId: instance.id })));
      for (let i = 0; i < settled.length; i++) {
        const s = settled[i];
        if (s.status !== "fulfilled") { console.error("ingest error", s.reason); continue; }
        const res: any = s.value;
        const it = items[i];
        if (!("lead_id" in res)) continue;
        leadIdForAudit = res.lead_id;
        // Background: fetch media binary if needed (also for existing rows missing media_url)
        if (res.needs_media && res.message_id) {
          const mediaTask = downloadAndStoreMedia(res.message_id, instance, it);
          // @ts-ignore
          if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(mediaTask);
          else mediaTask.catch((e) => console.error("media task failed", e));
        }
        // Fire-and-forget auto-reply for new messages.
        // Inbound: normal reply path. Outbound (from_me): only the silent classifier
        // agent will run (ai-auto-reply gates this) so the funnel can be re-evaluated
        // when the human answers.
        if (res.isNew) {
          const triggerAutoReply = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-auto-reply`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            },
            body: JSON.stringify({ lead_id: res.lead_id, from_me: !!it?.key?.fromMe }),
          }).catch((e) => console.error("auto-reply trigger failed", e));
          // @ts-ignore EdgeRuntime is available in Deno deploy
          if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(triggerAutoReply);

          // Try to attach tracking session for inbound messages (idempotent).
          if (!it?.key?.fromMe) {
            const triggerClaim = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/tracking-claim`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
              },
              body: JSON.stringify({ lead_id: res.lead_id }),
            }).catch((e) => console.error("tracking-claim trigger failed", e));
            // @ts-ignore
            if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(triggerClaim);
          }
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
        let { data: cur } = await supabase
          .from("messages")
          .select("id, delivery_status, lead_id")
          .eq("external_id", externalId)
          .maybeSingle();

        // Try to recover lost link: an outbound message we sent but whose ack came
        // before evolution-send returned the external_id. Match on most recent
        // pending/sent from_me message for this remoteJid's lead.
        if (!cur && it?.key?.fromMe) {
          const phone = it?.key?.remoteJidAlt?.split("@")[0]?.replace(/\D/g, "")
            ?? it?.key?.remoteJid?.split("@")[0]?.replace(/\D/g, "");
          if (phone) {
            const { data: lead } = await supabase.from("leads").select("id").eq("phone", phone).maybeSingle();
            if (lead) {
              const { data: orphan } = await supabase
                .from("messages")
                .select("id, delivery_status, lead_id")
                .eq("lead_id", lead.id).eq("from_me", true).is("external_id", null)
                .order("timestamp", { ascending: false }).limit(1).maybeSingle();
              if (orphan) {
                await supabase.from("messages").update({ external_id: externalId }).eq("id", orphan.id);
                cur = orphan;
              }
            }
          }
        }
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

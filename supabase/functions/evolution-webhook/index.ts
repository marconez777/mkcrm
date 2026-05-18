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

    // Normalize items: history events sometimes wrap an array under { messages: [...] }.
    let items: any[] = [];
    if (Array.isArray(body.data)) items = body.data;
    else if (Array.isArray(body.data?.messages)) items = body.data.messages;
    else if (Array.isArray(body.data?.chats)) items = body.data.chats;
    else items = [body.data];

    // Dedupe at the event-level. Prevents Evolution retries from double-processing.
    const dedupKey = `${eventType}::${instance.id}::${items[0]?.key?.id ?? ""}::${items[0]?.messageTimestamp ?? items[0]?.status ?? ""}`;
    if (dedupKey && (await isWebhookDuplicate(supabase, dedupKey))) {
      return json({ ok: true, deduped: true });
    }

    const { data: audit, error: auditErr } = await supabase
      .from("webhook_events")
      .insert({ event_type: eventType, payload: body, source: "webhook", clinic_id: instance.clinic_id })
      .select("id")
      .single();
    if (auditErr) console.error("webhook_events insert error", auditErr);
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

          // Mark broadcast recipient as replied (best-effort).
          if (!it?.key?.fromMe) {
            try {
              const supa = sb();
              const { data: leadRow } = await supa.from("leads").select("phone, clinic_id").eq("id", res.lead_id).maybeSingle();
              if (leadRow?.phone && leadRow?.clinic_id) {
                await supa.rpc("broadcast_mark_replied", { _clinic_id: leadRow.clinic_id, _phone: leadRow.phone });
              }
            } catch (e) { console.error("broadcast_mark_replied failed", e); }
          }

          // Inbound only: try to associate visitor_id → lead via tracking_code / ctwa_clid / phone.
          if (!it?.key?.fromMe) {
            const matchTask = matchTrackingForInbound({
              supabase: sb(),
              clinic_id: instance.clinic_id,
              lead_id: res.lead_id,
              item: it,
            }).catch((e) => console.error("tracking-match failed", e));
            // @ts-ignore
            if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(matchTask);
          }
        }
      }
    } else if (eventType === "MESSAGES_SET" || eventType === "MESSAGING_HISTORY_SET") {
      // History sync after (re)connection — Baileys delivers backlog here.
      // Ingest silently (no unread bump, no auto-reply trigger), idempotent by external_id.
      let imported = 0;
      const settled = await Promise.allSettled(
        items.map((it: any) => ingestMessage(it, "webhook", { silent: true, instanceId: instance.id })),
      );
      for (let i = 0; i < settled.length; i++) {
        const s = settled[i];
        if (s.status !== "fulfilled") { console.error("history ingest error", s.reason); continue; }
        const res: any = s.value;
        if (res?.isNew) imported++;
        if (res?.needs_media && res?.message_id) {
          const it = items[i];
          const t = downloadAndStoreMedia(res.message_id, instance, it);
          // @ts-ignore
          if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(t);
          else t.catch((e) => console.error("history media task failed", e));
        }
      }
      await supabase
        .from("whatsapp_instances")
        .update({
          last_backfill_at: new Date().toISOString(),
          last_backfill_imported: imported,
        })
        .eq("id", instance.id);
      console.log(JSON.stringify({ event: eventType, history_imported: imported, total: items.length }));
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
        const newState = String(state);
        const wasOpen = instance.connection_state === "open";
        await supabase
          .from("whatsapp_instances")
          .update({ connection_state: newState })
          .eq("id", instance.id);

        // Transition into "open" → trigger automatic backfill to recover any
        // messages that arrived while the session was down/silent.
        if (newState === "open" && !wasOpen) {
          await supabase
            .from("whatsapp_instances")
            .update({ last_reconnect_at: new Date().toISOString() })
            .eq("id", instance.id);

          const triggerBackfill = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-backfill-all`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            },
            body: JSON.stringify({ instance_id: instance.id, force: true, limit: 500 }),
          }).catch((e) => console.error("auto-backfill trigger failed", e));
          // @ts-ignore
          if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(triggerBackfill);
        }
      }
    }

    // Marca qualquer evento da Evolution como "sinal de vida" da sessão.
    // Antes filtrávamos só por MESSAGES_*, mas isso gerava falso positivo
    // quando ninguém escrevia por >15min. Qualquer evento (presence, chats,
    // connection update) prova que a Evolution está conversando conosco.
    await supabase
      .from("whatsapp_instances")
      .update({ last_inbound_webhook_at: new Date().toISOString() })
      .eq("id", instance.id);

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

// ============================================================================
// Tracking association: code in message body, ctwa_clid, or phone fallback.
// ============================================================================
// Matches the new format `(ref=xxxxxxxxxx)` (10-char lowercase hex)
// and the legacy format `MK-XXXXXX` (6-char uppercase) for backwards compat.
const TRACKING_CODE_RE = /(?:ref=([a-f0-9]{10})|(MK-[A-HJ-NP-Z2-9]{6}))/i;
function extractTrackingCode(text: string): string | null {
  const m = text.match(TRACKING_CODE_RE);
  if (!m) return null;
  return (m[1] ? m[1].toLowerCase() : m[2]?.toUpperCase()) ?? null;
}

function extractMessageText(item: any): string {
  const m = item?.message ?? {};
  return (
    m?.conversation
    ?? m?.extendedTextMessage?.text
    ?? m?.imageMessage?.caption
    ?? m?.videoMessage?.caption
    ?? m?.documentMessage?.caption
    ?? m?.buttonsResponseMessage?.selectedDisplayText
    ?? m?.listResponseMessage?.title
    ?? ""
  ) as string;
}

function extractCtwaClid(item: any): string | null {
  const ctx = item?.message?.extendedTextMessage?.contextInfo
    ?? item?.message?.imageMessage?.contextInfo
    ?? item?.message?.videoMessage?.contextInfo
    ?? item?.contextInfo
    ?? null;
  return (
    ctx?.externalAdReply?.ctwaClid
    ?? item?.message?.contextInfo?.externalAdReply?.ctwaClid
    ?? item?.ctwaClid
    ?? null
  ) ?? null;
}

async function matchTrackingForInbound(opts: {
  supabase: ReturnType<typeof sb>;
  clinic_id: string;
  lead_id: string;
  item: any;
}) {
  const { supabase, clinic_id, lead_id, item } = opts;

  // 1) Tracking code in latest 5 inbound messages of this lead
  let code: string | null = null;
  const currentText = extractMessageText(item);
  const m1 = currentText.match(TRACKING_CODE_RE);
  if (m1) code = m1[0];

  if (!code) {
    const { data: recent } = await supabase
      .from("messages")
      .select("content")
      .eq("lead_id", lead_id)
      .eq("from_me", false)
      .order("timestamp", { ascending: false })
      .limit(5);
    for (const row of (recent ?? [])) {
      const m = String((row as any).content ?? "").match(TRACKING_CODE_RE);
      if (m) { code = m[0]; break; }
    }
  }

  let visitor_id: string | null = null;
  let session_id: string | null = null;
  let intentRow: any = null;
  let linkSource = "phone_fallback";

  if (code) {
    const { data } = await supabase
      .from("whatsapp_intents")
      .select("id, visitor_id, session_id, status")
      .eq("clinic_id", clinic_id)
      .eq("tracking_code", code)
      .maybeSingle();
    if (data?.visitor_id) {
      visitor_id = data.visitor_id;
      session_id = data.session_id;
      intentRow = data;
      linkSource = "whatsapp_tracking_code";
    }
  }

  // 2) ctwa_clid (Click-to-WhatsApp Ads)
  const ctwaClid = extractCtwaClid(item);
  if (!visitor_id && ctwaClid) {
    const { data: sess } = await supabase
      .from("tracking_sessions")
      .select("visitor_id, session_id")
      .eq("clinic_id", clinic_id)
      .eq("ctwa_clid", ctwaClid)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sess?.visitor_id) {
      visitor_id = sess.visitor_id;
      session_id = sess.session_id;
      linkSource = "ctwa_clid";
    }
  }

  // 3) Fallback: most recent whatsapp_click session (last 2h)
  if (!visitor_id) {
    const { data: lead } = await supabase
      .from("leads").select("phone").eq("id", lead_id).maybeSingle();
    const phone: string | null = (lead as any)?.phone ?? null;

    if (phone) {
      // 3a) phone_hash already linked? skip identify (already linked) but still match intent.
      const phoneHash = await sha256Hex(phone);
      const { data: existingLink } = await supabase
        .from("tracking_identity_links")
        .select("visitor_id")
        .eq("clinic_id", clinic_id)
        .eq("phone_hash", phoneHash)
        .limit(1).maybeSingle();
      if (existingLink?.visitor_id) {
        visitor_id = existingLink.visitor_id;
        linkSource = "phone_hash_existing";
      }
    }
  }

  if (!visitor_id) {
    // 4) Last whatsapp_click event within 2h, unlinked.
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: ev } = await supabase
      .from("tracking_events")
      .select("visitor_id, session_id")
      .eq("clinic_id", clinic_id)
      .eq("event_name", "whatsapp_click")
      .is("lead_id", null)
      .gte("event_time", since)
      .order("event_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ev?.visitor_id) {
      visitor_id = ev.visitor_id;
      session_id = ev.session_id;
      linkSource = "whatsapp_click_recent";
    }
  }

  if (!visitor_id) {
    console.log("[tracking-match] no visitor", { clinic_id, lead_id, code, ctwaClid });
    return;
  }

  // Resolve clinic slug for tracking-identify project_id param.
  const { data: clinic } = await supabase
    .from("clinics").select("slug").eq("id", clinic_id).maybeSingle();
  if (!clinic?.slug) return;

  const { data: leadFull } = await supabase
    .from("leads").select("phone").eq("id", lead_id).maybeSingle();

  const identifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tracking-identify`;
  const resp = await fetch(identifyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      // Identify checks origin allowlist OR internal authorization. Service role here
      // doesn't carry a user JWT, so we rely on internal call by injecting Origin to match.
      "Origin": `https://${clinic.slug}.internal`,
    },
    body: JSON.stringify({
      project_id: clinic.slug,
      visitor_id,
      session_id,
      lead_id,
      phone: (leadFull as any)?.phone ?? null,
      source_event: linkSource,
      properties: { tracking_code: code, ctwa_clid: ctwaClid },
    }),
  });

  if (!resp.ok) {
    console.log("[tracking-match] identify failed", await resp.text().catch(() => ""));
  }

  // Mark intent matched + ctwa session-source pin
  if (intentRow?.id) {
    await supabase.from("whatsapp_intents")
      .update({ status: "matched", matched_at: new Date().toISOString(), lead_id })
      .eq("id", intentRow.id);
  }
  if (ctwaClid && visitor_id && session_id) {
    await supabase.from("tracking_sessions")
      .update({ ctwa_clid: ctwaClid })
      .eq("clinic_id", clinic_id)
      .eq("session_id", session_id);
  }

  console.log("[tracking-match] linked", { lead_id, visitor_id, linkSource });
}

async function sha256Hex(input: string): Promise<string> {
  const norm = input.replace(/\D/g, "");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}


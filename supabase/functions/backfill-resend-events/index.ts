// Edge Function: backfill-resend-events
// Super admin only. Re-sincroniza histórico do Resend para logs sem delivered_at.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return jsonResponse({ error: "RESEND_API_KEY missing" }, { status: 503 });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return jsonResponse({ error: "Unauthorized" }, { status: 401 });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: u.user.id });
    if (!isSuper) return jsonResponse({ error: "Forbidden" }, { status: 403 });

    const { data: logs } = await admin
      .from("email_logs")
      .select("id, clinic_id, resend_id, recipient_email, events")
      .not("resend_id", "is", null)
      .is("delivered_at", null)
      .order("sent_at", { ascending: false })
      .limit(200);

    let updated = 0, suppressed = 0;
    for (const log of (logs ?? []) as any[]) {
      try {
        const resp = await fetch(`https://api.resend.com/emails/${log.resend_id}`, {
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });
        if (!resp.ok) continue;
        const json = await resp.json();
        const lastEvent = json?.last_event ?? json?.status;
        const update: Record<string, unknown> = {};
        if (lastEvent === "delivered" || json.delivered_at) {
          update.status = "delivered";
          update.delivered_at = json.delivered_at ?? new Date().toISOString();
        } else if (lastEvent === "opened" || json.opened_at) {
          update.status = "opened";
          update.opened_at = json.opened_at ?? new Date().toISOString();
        } else if (lastEvent === "clicked" || json.clicked_at) {
          update.status = "clicked";
          update.clicked_at = json.clicked_at ?? new Date().toISOString();
        } else if (lastEvent === "bounced") {
          update.status = "bounced";
          update.bounced_at = new Date().toISOString();
          await admin.from("email_unsubscribes").upsert(
            { clinic_id: log.clinic_id, email: log.recipient_email, reason: "bounce", source: "backfill" },
            { onConflict: "clinic_id,email" },
          );
          suppressed++;
        } else if (lastEvent === "complained") {
          update.status = "complained";
          update.complained_at = new Date().toISOString();
          await admin.from("email_unsubscribes").upsert(
            { clinic_id: log.clinic_id, email: log.recipient_email, reason: "complaint", source: "backfill" },
            { onConflict: "clinic_id,email" },
          );
          suppressed++;
        }
        if (Object.keys(update).length) {
          await admin.from("email_logs").update(update).eq("id", log.id);
          updated++;
        }
      } catch (e) {
        console.error("backfill failed for", log.id, e);
      }
    }
    return jsonResponse({ ok: true, checked: logs?.length ?? 0, updated, suppressed });
  } catch (e) {
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});

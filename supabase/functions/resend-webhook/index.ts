// Edge Function: resend-webhook
// Recebe eventos do Resend (delivered/opened/clicked/bounced/complained).
// Valida assinatura Svix se RESEND_WEBHOOK_SECRET estiver setado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Webhook } from "https://esm.sh/svix@1.21.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const rawBody = await req.text();
    const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    let event: any;
    if (secret) {
      try {
        event = new Webhook(secret).verify(rawBody, {
          "svix-id": req.headers.get("svix-id") ?? "",
          "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
          "svix-signature": req.headers.get("svix-signature") ?? "",
        });
      } catch (e) {
        console.warn("resend-webhook invalid signature", e);
        return jsonResponse({ error: "invalid signature" }, { status: 401 });
      }
    } else {
      console.error("resend-webhook rejected: RESEND_WEBHOOK_SECRET is not configured");
      return jsonResponse({ error: "webhook secret not configured" }, { status: 401 });
    }

    const resendId = event?.data?.email_id;
    if (!resendId) return jsonResponse({ ok: true, ignored: "no email_id" });
    const eventTs = event.created_at || new Date().toISOString();

    // R-5: dedup por svix-id (Resend pode reentregar o mesmo evento)
    const svixId = req.headers.get("svix-id");
    if (svixId) {
      const { error: dedupErr } = await supabase
        .from("resend_webhook_events")
        .insert({ svix_id: svixId, event_type: event.type, resend_id: resendId });
      if (dedupErr) {
        // PK violation → já processado
        if ((dedupErr as any).code === "23505") {
          return jsonResponse({ ok: true, deduped: true });
        }
        console.warn("resend-webhook dedup insert error:", dedupErr);
      }
    }

    const { data: log } = await supabase
      .from("email_logs")
      .select("id, clinic_id, events, recipient_email")
      .eq("resend_id", resendId)
      .maybeSingle();
    if (!log) return jsonResponse({ ok: true, ignored: "log not found" });

    const events = Array.isArray(log.events) ? log.events : [];
    events.push({ type: event.type, at: eventTs, data: event.data });
    const update: Record<string, unknown> = { events };

    switch (event.type) {
      case "email.delivered":
        update.status = "delivered";
        update.delivered_at = eventTs;
        break;
      case "email.opened":
        update.opened_at = eventTs;
        update.status = "opened";
        break;
      case "email.clicked":
        update.clicked_at = eventTs;
        update.status = "clicked";
        break;
      case "email.bounced":
        update.status = "bounced";
        update.bounced_at = eventTs;
        // Supressão (insert em email_unsubscribes + remoção de email_segment_contacts)
        // é feita automaticamente pelo trigger trg_email_logs_suppress_on_bounce.
        break;
      case "email.complained":
        update.status = "complained";
        update.complained_at = eventTs;
        await supabase.from("email_unsubscribes").upsert(
          { clinic_id: log.clinic_id, email: log.recipient_email, reason: "complaint", source: "resend-webhook" },
          { onConflict: "clinic_id,email" },
        );
        break;
    }
    await supabase.from("email_logs").update(update).eq("id", log.id);
    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("resend-webhook error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});

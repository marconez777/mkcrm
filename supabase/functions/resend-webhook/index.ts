// Edge Function: resend-webhook
import { applyLeadOrigin, originFor } from "../_shared/lead-origin.ts";
// Recebe eventos do Resend (delivered/opened/clicked/bounced/complained).
// Valida assinatura Svix contra TODAS as envs RESEND_WEBHOOK_SECRET* —
// cada conta Resend (ex.: MCD) tem seu próprio signing secret.

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
    // Multi-conta: aceita qualquer env cujo nome comece com RESEND_WEBHOOK_SECRET
    // (RESEND_WEBHOOK_SECRET, RESEND_WEBHOOK_SECRET_MCD, ...). O secret principal
    // vem primeiro (nome mais curto) porque concentra o grosso do tráfego.
    let secrets: string[] = [];
    try {
      secrets = Object.entries(Deno.env.toObject())
        .filter(([k, v]) => k.startsWith("RESEND_WEBHOOK_SECRET") && v)
        .sort(([a], [b]) => a.length - b.length)
        .map(([, v]) => v);
    } catch {
      const single = Deno.env.get("RESEND_WEBHOOK_SECRET");
      if (single) secrets = [single];
    }
    if (!secrets.length) {
      console.error("resend-webhook rejected: RESEND_WEBHOOK_SECRET is not configured");
      return jsonResponse({ error: "webhook secret not configured" }, { status: 401 });
    }
    const svixHeaders = {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    };
    let event: any = null;
    for (const s of secrets) {
      try {
        event = new Webhook(s).verify(rawBody, svixHeaders);
        break;
      } catch {
        // assinatura não bate com este secret — tenta o próximo
      }
    }
    if (!event) {
      console.warn(`resend-webhook invalid signature (${secrets.length} secrets testados)`);
      return jsonResponse({ error: "invalid signature" }, { status: 401 });
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
      .select("id, clinic_id, events, recipient_email, related_lead_id, related_lead_table, template_slug")
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
      case "email.clicked": {
        update.clicked_at = eventTs;
        update.status = "clicked";
        // Origem nativa: clique em e-mail marketing atribui o lead ao canal
        // "email" (prioridade menor que tracking web, nunca sobrescreve manual).
        if (log.related_lead_id && (log.related_lead_table ?? "leads") === "leads") {
          await applyLeadOrigin(
            supabase as any,
            log.related_lead_id,
            originFor("email", log.template_slug ?? null, "email"),
          ).catch((e) => console.error("resend-webhook origin error", e));
        }
        break;
      }
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

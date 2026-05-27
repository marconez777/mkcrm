// Edge Function: send-email-batch
// R-15 (Tier 2): envia até 100 e-mails em UMA chamada via Resend /emails/batch.
// Espera lista de jobs do MESMO clinic_id + template_slug. Faz dedup, quota,
// warm-up e throttle ANTES de mandar; quem não passa é re-agendado/cancelado.
//
// Body:
// {
//   clinic_id: string,
//   template_slug: string,
//   jobs: [{ queue_id, recipient_email, recipient_name?, variables?, related_lead_id?, related_lead_table?, force?, from_name_override? }]
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, renderTemplate, sanitizeTagValue, isInternalContext } from "../_shared/email.ts";

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://mkcrm.lovable.app";
const RESEND_BATCH_MAX = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const DEFAULT_RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (token !== SERVICE_ROLE_KEY) return jsonResponse({ error: "Forbidden" }, { status: 403 });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json();
    const { clinic_id, template_slug, jobs, from_domain_override, idempotency_key } = body ?? {};
    if (!clinic_id || !template_slug || !Array.isArray(jobs) || jobs.length === 0) {
      return jsonResponse({ error: "missing clinic_id, template_slug or jobs[]" }, { status: 400 });
    }
    if (jobs.length > RESEND_BATCH_MAX) {
      return jsonResponse({ error: `max ${RESEND_BATCH_MAX} jobs per call` }, { status: 400 });
    }

    // feature gate
    const { data: featureOk } = await supabase.rpc("clinic_has_feature", { _clinic_id: clinic_id, _key: "email_marketing" });
    if (!featureOk) return jsonResponse({ error: "feature_disabled" }, { status: 403 });

    // template
    const { data: template } = await supabase
      .from("email_templates").select("*")
      .eq("clinic_id", clinic_id).eq("slug", template_slug).eq("active", true)
      .maybeSingle();
    if (!template) return jsonResponse({ error: "template not found" }, { status: 404 });

    // R-21: rotação de domínio (override aplicado a todo o batch)
    const tplDomain = String(template.from_email).split("@")[1]?.toLowerCase();
    const overrideDomain = typeof from_domain_override === "string" ? from_domain_override.trim().toLowerCase() : "";
    const fromDomain = overrideDomain || tplDomain;
    if (!fromDomain) return jsonResponse({ error: "invalid from_email" }, { status: 400 });
    const effectiveFromEmail = overrideDomain
      ? `${String(template.from_email).split("@")[0]}@${overrideDomain}`
      : String(template.from_email);

    // domínio (valida o efetivo)
    const { data: dom } = await supabase
      .from("email_domains").select("status")
      .eq("clinic_id", clinic_id).eq("domain", fromDomain).maybeSingle();
    if (!dom || (dom.status !== "verified" && dom.status !== "partially_verified")) {
      return jsonResponse({ error: `domain ${fromDomain} not verified` }, { status: 412 });
    }


    // integração / api key
    let RESEND_API_KEY = DEFAULT_RESEND_API_KEY;
    const { data: integ } = await supabase
      .from("clinic_email_integrations")
      .select("secret_name, enabled")
      .eq("clinic_id", clinic_id).eq("enabled", true).maybeSingle();
    if (integ?.secret_name) {
      const k = Deno.env.get(integ.secret_name);
      if (k) RESEND_API_KEY = k;
    }
    if (!RESEND_API_KEY) return jsonResponse({ error: "RESEND_API_KEY missing" }, { status: 503 });

    // clínica para tag
    const { data: clinicRow } = await supabase.from("clinics").select("slug").eq("id", clinic_id).maybeSingle();

    // unsubscribes (1 query — todas as suppressed deste lote)
    const emailsLower = jobs.map((j: any) => String(j.recipient_email).toLowerCase());
    const { data: unsubs } = await supabase
      .from("email_unsubscribes").select("email")
      .eq("clinic_id", clinic_id).in("email", emailsLower);
    const unsubSet = new Set((unsubs ?? []).map((u: any) => u.email));

    // ---- pré-processamento por job: dedup + quota + warmup + throttle + render ----
    type Prepared = {
      job: any;
      email: string;
      destDomain: string;
      payload: any;
      dedupContext: string;
      useDedup: boolean;
    };
    const prepared: Prepared[] = [];
    const skipped: Array<{ queue_id: string; reason: string; reschedule_at?: string; error?: string }> = [];

    for (const job of jobs) {
      const email = String(job.recipient_email).toLowerCase().trim();
      const destDomain = email.split("@")[1] ?? "unknown";

      if (!job.force && unsubSet.has(email)) {
        skipped.push({ queue_id: job.queue_id, reason: "unsubscribed" });
        continue;
      }

      // dedup
      const dedupContext = job.related_lead_table ?? "";
      const useDedup = !isInternalContext(job.related_lead_table) && !!job.related_lead_table;
      if (useDedup) {
        const { error: dedupErr } = await supabase
          .from("email_send_dedup")
          .insert({ clinic_id, template_slug, email, context: dedupContext });
        if (dedupErr && (dedupErr as any).code === "23505") {
          skipped.push({ queue_id: job.queue_id, reason: "already_sent" });
          continue;
        }
      }

      // quota
      const { data: claim } = await supabase.rpc("claim_email_quota", { _clinic_id: clinic_id }).single();
      if ((claim as any)?.allowed === false) {
        if (useDedup) {
          await supabase.from("email_send_dedup").delete()
            .eq("clinic_id", clinic_id).eq("template_slug", template_slug)
            .eq("email", email).eq("context", dedupContext);
        }
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(12, 0, 0, 0);
        skipped.push({ queue_id: job.queue_id, reason: "quota_reached", reschedule_at: tomorrow.toISOString(), error: "daily quota reached" });
        continue;
      }

      // warmup
      const { data: warmupClaim } = await supabase
        .rpc("claim_domain_warmup", { _clinic_id: clinic_id, _domain: fromDomain }).single();
      if ((warmupClaim as any)?.allowed === false) {
        if (useDedup) {
          await supabase.from("email_send_dedup").delete()
            .eq("clinic_id", clinic_id).eq("template_slug", template_slug)
            .eq("email", email).eq("context", dedupContext);
        }
        await supabase.from("email_send_state")
          .update({ sent_today: Math.max(((claim as any)?.sent_today ?? 1) - 1, 0), updated_at: new Date().toISOString() })
          .eq("clinic_id", clinic_id);
        skipped.push({ queue_id: job.queue_id, reason: "warmup_cap_reached", reschedule_at: new Date(Date.now() + 30 * 60_000).toISOString(), error: `warmup cap (${(warmupClaim as any).daily_cap})` });
        continue;
      }

      // throttle por destino
      const { data: throttleClaim } = await supabase
        .rpc("claim_recipient_throttle", { _clinic_id: clinic_id, _dest_domain: destDomain, _limit_per_hour: 1000 }).single();
      if ((throttleClaim as any)?.allowed === false) {
        if (useDedup) {
          await supabase.from("email_send_dedup").delete()
            .eq("clinic_id", clinic_id).eq("template_slug", template_slug)
            .eq("email", email).eq("context", dedupContext);
        }
        await supabase.from("email_send_state")
          .update({ sent_today: Math.max(((claim as any)?.sent_today ?? 1) - 1, 0), updated_at: new Date().toISOString() })
          .eq("clinic_id", clinic_id);
        await supabase.rpc("release_domain_warmup", { _clinic_id: clinic_id, _domain: fromDomain });
        const win = new Date((throttleClaim as any).window_start ?? Date.now());
        skipped.push({ queue_id: job.queue_id, reason: "recipient_throttle", reschedule_at: new Date(win.getTime() + 60 * 60_000 + 5_000).toISOString(), error: `throttle ${destDomain}` });
        continue;
      }

      // render
      const { data: tokenData } = await supabase.rpc("generate_unsubscribe_token", { _clinic_id: clinic_id, _email: email });
      const unsubscribeUrl =
        `${SITE_URL}/unsubscribe?clinic=${encodeURIComponent(clinic_id)}&email=${encodeURIComponent(email)}&token=${tokenData ?? ""}`;
      const renderVars = {
        ...(job.variables ?? {}),
        recipient_email: email,
        recipient_name: job.recipient_name ?? (job.variables ?? {}).name ?? "",
        unsubscribe_url: unsubscribeUrl,
        site_url: SITE_URL,
        year: new Date().getFullYear(),
      };
      // R-20: subject override por variante
      const subjectSrc = (typeof job.subject_override === "string" && job.subject_override.trim())
        || (typeof (job.variables ?? {}).subject_override === "string" && (job.variables ?? {}).subject_override.trim())
        || template.subject;
      const subject = renderTemplate(subjectSrc, renderVars);
      const html = renderTemplate(template.html_body, renderVars);
      const text = template.text_body ? renderTemplate(template.text_body, renderVars) : undefined;

      const overrideName = typeof job.from_name_override === "string" ? job.from_name_override.trim() : "";
      const fromName = overrideName || String(template.from_name ?? "").trim();
      const fromHeader = fromName ? `${fromName} <${effectiveFromEmail}>` : effectiveFromEmail;


      const payload: Record<string, unknown> = {
        from: fromHeader,
        to: [job.recipient_name ? `${job.recipient_name} <${email}>` : email],
        subject,
        html,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${template.from_email}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [
          { name: "template", value: sanitizeTagValue(template_slug) },
          { name: "category", value: sanitizeTagValue(template.category || "marketing") },
          { name: "clinic", value: sanitizeTagValue(clinicRow?.slug ?? clinic_id) },
        ],
      };
      if (text) (payload as any).text = text;
      if (template.reply_to && String(template.reply_to).trim()) {
        (payload as any).reply_to = String(template.reply_to).trim();
      }

      prepared.push({ job, email, destDomain, payload, dedupContext, useDedup });
    }

    // ---- aplica skips na fila ----
    for (const s of skipped) {
      if (s.reschedule_at) {
        await supabase.from("email_queue").update({
          status: "pending", scheduled_at: s.reschedule_at,
          error: s.error ?? s.reason, updated_at: new Date().toISOString(),
        }).eq("id", s.queue_id);
      } else {
        const newStatus = s.reason === "already_sent" ? "sent" : "cancelled";
        await supabase.from("email_queue").update({
          status: newStatus, sent_at: newStatus === "sent" ? new Date().toISOString() : null,
          error: s.error ?? s.reason, updated_at: new Date().toISOString(),
        }).eq("id", s.queue_id);
      }
    }

    if (prepared.length === 0) {
      return jsonResponse({ ok: true, sent: 0, skipped: skipped.length });
    }

    // ---- Resend /emails/batch ----
    const resp = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(prepared.map((p) => p.payload)),
    });
    const json: any = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      // libera tudo
      for (const p of prepared) {
        if (p.useDedup) {
          await supabase.from("email_send_dedup").delete()
            .eq("clinic_id", clinic_id).eq("template_slug", template_slug)
            .eq("email", p.email).eq("context", p.dedupContext);
        }
        await supabase.rpc("release_domain_warmup", { _clinic_id: clinic_id, _domain: fromDomain });
      }
      // re-pending dos jobs
      await supabase.from("email_queue").update({
        status: "pending",
        scheduled_at: new Date(Date.now() + 60_000).toISOString(),
        error: json?.message || `batch failed ${resp.status}`,
        updated_at: new Date().toISOString(),
      }).in("id", prepared.map((p) => p.job.queue_id));
      return jsonResponse({ error: json?.message || "batch failed", resend: json }, { status: 502 });
    }

    // ---- match resultado ao job (por posição) ----
    const results: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

    const logsToInsert: any[] = [];
    const sentIds: string[] = [];
    for (let i = 0; i < prepared.length; i++) {
      const p = prepared[i];
      const r = results[i];
      const resendId = r?.id;
      if (resendId) {
        sentIds.push(p.job.queue_id);
        logsToInsert.push({
          clinic_id, resend_id: resendId, template_slug,
          recipient_email: p.email, subject: p.payload.subject,
          status: "sent",
          related_lead_id: p.job.related_lead_id ?? null,
          related_lead_table: p.job.related_lead_table ?? null,
          variant_id: p.job.variant_id ?? null,
          from_domain_override: overrideDomain || null,
          events: [{ type: "sent", at: new Date().toISOString(), batch: true }],
        });

        if (p.useDedup) {
          await supabase.from("email_send_dedup")
            .update({ resend_id: resendId })
            .eq("clinic_id", clinic_id).eq("template_slug", template_slug)
            .eq("email", p.email).eq("context", p.dedupContext);
        }
      } else {
        // este job específico não retornou id
        if (p.useDedup) {
          await supabase.from("email_send_dedup").delete()
            .eq("clinic_id", clinic_id).eq("template_slug", template_slug)
            .eq("email", p.email).eq("context", p.dedupContext);
        }
        await supabase.rpc("release_domain_warmup", { _clinic_id: clinic_id, _domain: fromDomain });
        await supabase.from("email_queue").update({
          status: "pending",
          scheduled_at: new Date(Date.now() + 60_000).toISOString(),
          error: r?.message || "no id returned",
          updated_at: new Date().toISOString(),
        }).eq("id", p.job.queue_id);
      }
    }

    if (logsToInsert.length) {
      await supabase.from("email_logs").insert(logsToInsert);
    }
    if (sentIds.length) {
      await supabase.from("email_queue").update({
        status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).in("id", sentIds);
    }

    return jsonResponse({ ok: true, sent: sentIds.length, skipped: skipped.length, total: jobs.length });
  } catch (e) {
    console.error("send-email-batch error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});

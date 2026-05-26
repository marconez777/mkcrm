// Edge Function: send-email
// Renderiza template, checa suppression + dedup + cota + domínio, envia via Resend e loga.
// Tier 1: cache em memória (templates/domínios/integrações/clínica), dedup atômico via
// email_send_dedup, cota atômica via claim_email_quota.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, renderTemplate, sanitizeTagValue, isInternalContext } from "../_shared/email.ts";

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://mkcrm.lovable.app";

// --- Cache em memória do isolate (TTL curto, invalidação por updated_at) ---
const CACHE_TTL_MS = 60_000;
type CacheEntry<T> = { value: T; expiresAt: number };
const tplCache = new Map<string, CacheEntry<any>>();
const domCache = new Map<string, CacheEntry<any>>();
const intCache = new Map<string, CacheEntry<any>>();
const clinicCache = new Map<string, CacheEntry<any>>();

function getCached<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const e = map.get(key);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) { map.delete(key); return undefined; }
  return e.value;
}
function setCached<T>(map: Map<string, CacheEntry<T>>, key: string, value: T) {
  map.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const DEFAULT_RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: service-role OU admin JWT
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    let authorized = token === SERVICE_ROLE_KEY;
    let callerUserId: string | null = null;
    let adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let preBody: any = null;
    if (!authorized) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (u?.user) {
        callerUserId = u.user.id;
        const { data: isSuper } = await adminClient.rpc("is_super_admin", { _user_id: u.user.id });
        if (isSuper) authorized = true;
        if (!authorized) {
          // Permite se o usuário é owner/admin da clínica alvo
          try { preBody = await req.clone().json(); } catch {}
          const targetClinic = preBody?.clinic_id;
          if (targetClinic) {
            const { data: mem } = await adminClient
              .from("clinic_members")
              .select("role")
              .eq("user_id", u.user.id)
              .eq("clinic_id", targetClinic)
              .in("role", ["owner", "admin"])
              .maybeSingle();
            if (mem) authorized = true;
          }
        }
      }
    }
    if (!authorized) return jsonResponse({ error: "Forbidden" }, { status: 403 });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json();
    const {
      clinic_id,
      template_slug,
      recipient_email,
      recipient_name,
      variables = {},
      related_lead_id,
      related_lead_table,
      force = false,
      queue_id,
      from_name_override,
      from_domain_override,
      variant_id,
      subject_override,
    } = body ?? {};


    if (!clinic_id || !template_slug || !recipient_email) {
      return jsonResponse({ error: "missing fields: clinic_id, template_slug, recipient_email" }, { status: 400 });
    }
    const email = String(recipient_email).toLowerCase().trim();

    // 0. Feature gating
    const { data: featureOk } = await supabase.rpc("clinic_has_feature", { _clinic_id: clinic_id, _key: "email_marketing" });
    if (!featureOk) {
      if (queue_id) {
        await supabase.from("email_queue")
          .update({ status: "cancelled", error: "feature disabled", updated_at: new Date().toISOString() })
          .eq("id", queue_id);
      }
      return jsonResponse({ skipped: true, reason: "feature_disabled" });
    }

    // 1. Template (cache 60s)
    const tplKey = `${clinic_id}:${template_slug}`;
    let template: any = getCached(tplCache, tplKey);
    if (!template) {
      const { data } = await supabase
        .from("email_templates")
        .select("*")
        .eq("clinic_id", clinic_id)
        .eq("slug", template_slug)
        .eq("active", true)
        .maybeSingle();
      template = data;
      if (template) setCached(tplCache, tplKey, template);
    }
    if (!template) {
      return jsonResponse({ error: `Template ${template_slug} not found or inactive` }, { status: 404 });
    }

    // 1.1 Domínio remetente precisa estar verificado (cache 60s)
    // R-21: se from_domain_override veio do dispatcher (multi-domain rotation),
    // valida e usa o override para warmup/throttle.
    const tplDomain = String(template.from_email).split("@")[1]?.toLowerCase();
    const overrideDomain = typeof from_domain_override === "string" ? from_domain_override.trim().toLowerCase() : "";
    const fromDomain = overrideDomain || tplDomain;
    if (!fromDomain) {
      return jsonResponse({ error: "invalid from_email in template" }, { status: 400 });
    }

    const domKey = `${clinic_id}:${fromDomain}`;
    let dom: any = getCached(domCache, domKey);
    if (!dom) {
      const { data } = await supabase
        .from("email_domains")
        .select("status")
        .eq("clinic_id", clinic_id)
        .eq("domain", fromDomain)
        .maybeSingle();
      dom = data;
      if (dom) setCached(domCache, domKey, dom);
    }
    if (!dom || (dom.status !== "verified" && dom.status !== "partially_verified")) {
      if (queue_id) {
        await supabase.from("email_queue")
          .update({ status: "failed", error: `domain ${fromDomain} not verified`, updated_at: new Date().toISOString() })
          .eq("id", queue_id);
      }
      return jsonResponse({ error: `domain ${fromDomain} not verified` }, { status: 412 });
    }


    // 1.2 Resolve a API key do Resend (cache 60s da integração)
    let RESEND_API_KEY = DEFAULT_RESEND_API_KEY;
    let integration: any = getCached(intCache, clinic_id);
    if (integration === undefined) {
      const { data } = await supabase
        .from("clinic_email_integrations")
        .select("provider, secret_name, enabled")
        .eq("clinic_id", clinic_id)
        .eq("enabled", true)
        .maybeSingle();
      integration = data ?? null;
      setCached(intCache, clinic_id, integration);
    }
    if (integration?.secret_name) {
      const k = Deno.env.get(integration.secret_name);
      if (k) {
        RESEND_API_KEY = k;
      } else {
        console.warn(`clinic ${clinic_id} integration secret ${integration.secret_name} not set, falling back to default`);
      }
    }
    if (!RESEND_API_KEY) {
      return jsonResponse({ error: "RESEND_API_KEY missing (no clinic integration and no default)" }, { status: 503 });
    }

    // 2. Suppression
    if (!force) {
      const { data: unsub } = await supabase
        .from("email_unsubscribes")
        .select("email")
        .eq("clinic_id", clinic_id)
        .eq("email", email)
        .maybeSingle();
      if (unsub) {
        if (queue_id) {
          await supabase.from("email_queue")
            .update({ status: "cancelled", error: "recipient unsubscribed", updated_at: new Date().toISOString() })
            .eq("id", queue_id);
        }
        return jsonResponse({ skipped: true, reason: "unsubscribed" });
      }
    }

    // 3. Idempotência atômica via email_send_dedup (R-10)
    // Insere antes do envio; se já existir (UNIQUE), é replay.
    const dedupContext = related_lead_table ?? "";
    const useDedup = !isInternalContext(related_lead_table) && !!related_lead_table;
    if (useDedup) {
      const { error: dedupErr } = await supabase
        .from("email_send_dedup")
        .insert({ clinic_id, template_slug, email, context: dedupContext });
      if (dedupErr && (dedupErr as any).code === "23505") {
        if (queue_id) {
          await supabase.from("email_queue")
            .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", queue_id);
        }
        return jsonResponse({ skipped: true, reason: "already_sent" });
      }
      if (dedupErr) {
        // erro inesperado — apenas loga, segue (não bloquear envio por isso)
        console.warn("dedup insert error:", dedupErr.message);
      }
    }

    // 4. Cota diária por clínica — claim atômico (R-11)
    const { data: claim, error: claimErr } = await supabase
      .rpc("claim_email_quota", { _clinic_id: clinic_id })
      .single();
    if (claimErr) console.warn("claim_email_quota error:", claimErr.message);
    const allowed = (claim as any)?.allowed ?? true;
    if (!allowed) {
      if (useDedup) {
        await supabase.from("email_send_dedup").delete()
          .eq("clinic_id", clinic_id).eq("template_slug", template_slug)
          .eq("email", email).eq("context", dedupContext);
      }
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(12, 0, 0, 0);
      if (queue_id) {
        await supabase.from("email_queue")
          .update({ status: "pending", scheduled_at: tomorrow.toISOString(), error: "daily quota reached", updated_at: new Date().toISOString() })
          .eq("id", queue_id);
      }
      return jsonResponse({ skipped: true, reason: "quota_reached" });
    }

    // 4.1 R-12: warm-up do domínio remetente (sem registro = sem cap)
    const { data: warmupClaim } = await supabase
      .rpc("claim_domain_warmup", { _clinic_id: clinic_id, _domain: fromDomain })
      .single();
    if ((warmupClaim as any) && (warmupClaim as any).allowed === false) {
      if (useDedup) {
        await supabase.from("email_send_dedup").delete()
          .eq("clinic_id", clinic_id).eq("template_slug", template_slug)
          .eq("email", email).eq("context", dedupContext);
      }
      await supabase.from("email_send_state")
        .update({ sent_today: Math.max(((claim as any)?.sent_today ?? 1) - 1, 0), updated_at: new Date().toISOString() })
        .eq("clinic_id", clinic_id);
      const next = new Date(Date.now() + 30 * 60_000).toISOString();
      if (queue_id) {
        await supabase.from("email_queue")
          .update({ status: "pending", scheduled_at: next, error: `warmup cap reached (${(warmupClaim as any).daily_cap})`, updated_at: new Date().toISOString() })
          .eq("id", queue_id);
      }
      return jsonResponse({ skipped: true, reason: "warmup_cap_reached", cap: (warmupClaim as any).daily_cap });
    }

    // 4.2 R-13: rate-limit por domínio destinatário (1000/h)
    const destDomain = email.split("@")[1]?.toLowerCase() ?? "unknown";
    const { data: throttleClaim } = await supabase
      .rpc("claim_recipient_throttle", { _clinic_id: clinic_id, _dest_domain: destDomain, _limit_per_hour: 1000 })
      .single();
    if ((throttleClaim as any) && (throttleClaim as any).allowed === false) {
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
      const next = new Date(win.getTime() + 60 * 60_000 + 5_000).toISOString();
      if (queue_id) {
        await supabase.from("email_queue")
          .update({ status: "pending", scheduled_at: next, error: `recipient throttle (${destDomain})`, updated_at: new Date().toISOString() })
          .eq("id", queue_id);
      }
      return jsonResponse({ skipped: true, reason: "recipient_throttle", dest_domain: destDomain });
    }

    // 5. Unsubscribe URL
    const { data: tokenData } = await supabase.rpc("generate_unsubscribe_token", { _clinic_id: clinic_id, _email: email });
    const unsubscribeUrl =
      `${SITE_URL}/unsubscribe?clinic=${encodeURIComponent(clinic_id)}&email=${encodeURIComponent(email)}&token=${tokenData ?? ""}`;

    const renderVars = {
      ...variables,
      recipient_email: email,
      recipient_name: recipient_name ?? (variables as any).name ?? "",
      unsubscribe_url: unsubscribeUrl,
      site_url: SITE_URL,
      year: new Date().getFullYear(),
    };

    // 6. Render (subject_override permite A/B test)
    const subjectSrc = (typeof subject_override === "string" && subject_override.trim())
      || (typeof (variables as any)?.subject_override === "string" && (variables as any).subject_override.trim())
      || template.subject;
    const subject = renderTemplate(subjectSrc, renderVars);
    const html = renderTemplate(template.html_body, renderVars);
    const text = template.text_body ? renderTemplate(template.text_body, renderVars) : undefined;

    // 7. Slug da clínica para tag (cache 60s)
    let clinicRow: any = getCached(clinicCache, clinic_id);
    if (!clinicRow) {
      const { data } = await supabase.from("clinics").select("slug").eq("id", clinic_id).maybeSingle();
      clinicRow = data;
      if (clinicRow) setCached(clinicCache, clinic_id, clinicRow);
    }

    // R-21: aplica domain override (rotação) preservando o local-part
    let fromEmail = String(template.from_email ?? "").trim();
    const domOverride = typeof from_domain_override === "string" ? from_domain_override.trim().toLowerCase() : "";
    if (domOverride && fromEmail.includes("@")) {
      fromEmail = `${fromEmail.split("@")[0]}@${domOverride}`;
    }
    const overrideName = typeof from_name_override === "string" ? from_name_override.trim() : "";
    const fromName = overrideName || String(template.from_name ?? "").trim();
    const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;


    const resendBody: Record<string, unknown> = {
      from: fromHeader,
      to: [recipient_name ? `${recipient_name} <${email}>` : email],
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
    if (text) (resendBody as any).text = text;
    if (template.reply_to && String(template.reply_to).trim()) {
      (resendBody as any).reply_to = String(template.reply_to).trim();
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(resendBody),
    });
    const json = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      // libera dedup (envio falhou)
      if (useDedup) {
        await supabase.from("email_send_dedup")
          .delete()
          .eq("clinic_id", clinic_id)
          .eq("template_slug", template_slug)
          .eq("email", email)
          .eq("context", dedupContext);
      }
      // decrementa cota (já foi consumida pelo claim)
      await supabase.from("email_send_state")
        .update({ sent_today: Math.max(((claim as any)?.sent_today ?? 1) - 1, 0), updated_at: new Date().toISOString() })
        .eq("clinic_id", clinic_id);
      // libera warmup do dia (envio não saiu)
      await supabase.rpc("release_domain_warmup", { _clinic_id: clinic_id, _domain: fromDomain });
      await supabase.from("email_logs").insert({
        clinic_id,
        template_slug,
        recipient_email: email,
        subject,
        status: "failed",
        error: json?.message || JSON.stringify(json),
        related_lead_id: related_lead_id ?? null,
        related_lead_table: related_lead_table ?? null,
        variant_id: variant_id ?? null,
        from_domain_override: overrideDomain || null,
        events: [{ type: "send_failed", at: new Date().toISOString(), data: json }],
      });
      return jsonResponse({ error: json?.message || "send failed", resend: json }, { status: 502 });
    }

    const { data: logRow } = await supabase
      .from("email_logs")
      .insert({
        clinic_id,
        resend_id: json.id,
        template_slug,
        recipient_email: email,
        subject,
        status: "sent",
        related_lead_id: related_lead_id ?? null,
        related_lead_table: related_lead_table ?? null,
        variant_id: variant_id ?? null,
        from_domain_override: overrideDomain || null,
        events: [{ type: "sent", at: new Date().toISOString() }],
      })
      .select("id")
      .single();


    // (cota já consumida atomicamente em claim_email_quota acima)

    // atualiza dedup com resend_id para auditoria
    if (useDedup) {
      await supabase.from("email_send_dedup")
        .update({ resend_id: json.id })
        .eq("clinic_id", clinic_id)
        .eq("template_slug", template_slug)
        .eq("email", email)
        .eq("context", dedupContext);
    }

    return jsonResponse({ ok: true, resend_id: json.id, log_id: logRow?.id });
  } catch (e) {
    console.error("send-email error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});

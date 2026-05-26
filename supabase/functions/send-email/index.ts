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
    const fromDomain = String(template.from_email).split("@")[1]?.toLowerCase();
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

    // 3. Idempotência por (clinic, slug, email, contexto)
    if (!isInternalContext(related_lead_table) && related_lead_table) {
      const { data: existing } = await supabase
        .from("email_logs")
        .select("id")
        .eq("clinic_id", clinic_id)
        .eq("template_slug", template_slug)
        .eq("recipient_email", email)
        .eq("related_lead_table", related_lead_table)
        .in("status", ["sent", "delivered", "opened", "clicked"])
        .maybeSingle();
      if (existing) {
        if (queue_id) {
          await supabase.from("email_queue")
            .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", queue_id);
        }
        return jsonResponse({ skipped: true, reason: "already_sent" });
      }
    }

    // 4. Cota diária por clínica
    const { data: quotaVal } = await supabase.rpc("clinic_email_quota", { _clinic_id: clinic_id });
    const quota = Number(quotaVal ?? 1000);
    const { data: state } = await supabase
      .from("email_send_state")
      .select("sent_today, quota_resets_at")
      .eq("clinic_id", clinic_id)
      .maybeSingle();
    const nowD = new Date();
    let sentToday = 0;
    if (state) {
      const resets = new Date(state.quota_resets_at);
      sentToday = resets <= nowD ? 0 : (state.sent_today ?? 0);
    }
    if (sentToday >= quota) {
      // Reagenda para 9h BRT do dia seguinte (12h UTC)
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

    // 6. Render
    const subject = renderTemplate(template.subject, renderVars);
    const html = renderTemplate(template.html_body, renderVars);
    const text = template.text_body ? renderTemplate(template.text_body, renderVars) : undefined;

    // 7. Carrega slug da clínica para tag
    const { data: clinicRow } = await supabase.from("clinics").select("slug").eq("id", clinic_id).maybeSingle();

    const fromEmail = String(template.from_email ?? "").trim();
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
      await supabase.from("email_logs").insert({
        clinic_id,
        template_slug,
        recipient_email: email,
        subject,
        status: "failed",
        error: json?.message || JSON.stringify(json),
        related_lead_id: related_lead_id ?? null,
        related_lead_table: related_lead_table ?? null,
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
        events: [{ type: "sent", at: new Date().toISOString() }],
      })
      .select("id")
      .single();

    // Atualiza cota
    await supabase.from("email_send_state").upsert(
      {
        clinic_id,
        sent_today: sentToday + 1,
        quota_resets_at: state?.quota_resets_at ?? new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id" },
    );

    return jsonResponse({ ok: true, resend_id: json.id, log_id: logRow?.id });
  } catch (e) {
    console.error("send-email error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});

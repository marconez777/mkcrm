// Edge Function: email-domain-manage
// Super admin gerencia domínios via Resend API.
// Actions: create | verify | delete

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

const RESEND_BASE = "https://api.resend.com";

async function resolveResendKey(admin: any, clinicId?: string | null, domainId?: string | null): Promise<string | null> {
  let cid = clinicId ?? null;
  if (!cid && domainId) {
    const { data: d } = await admin.from("email_domains").select("clinic_id").eq("id", domainId).maybeSingle();
    cid = d?.clinic_id ?? null;
  }
  if (cid) {
    const { data: integ } = await admin
      .from("clinic_email_integrations")
      .select("secret_name, enabled")
      .eq("clinic_id", cid)
      .maybeSingle();
    if (integ?.enabled && integ?.secret_name) {
      const key = Deno.env.get(integ.secret_name);
      if (key) return key;
    }
  }
  return Deno.env.get("RESEND_API_KEY") ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return jsonResponse({ error: "Unauthorized" }, { status: 401 });

    // Apenas super admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: u.user.id });
    if (!isSuper) return jsonResponse({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action, clinic_id, domain, domain_id, region = "us-east-1" } = body ?? {};

    if (action === "create") {
      if (!clinic_id || !domain) return jsonResponse({ error: "missing clinic_id or domain" }, { status: 400 });
      const cleanDomain = String(domain).toLowerCase().trim();
      const RESEND_API_KEY = await resolveResendKey(admin, clinic_id, null);
      if (!RESEND_API_KEY) return jsonResponse({ error: "Resend API key not configured for this clinic" }, { status: 503 });
      const cleanDomain = String(domain).toLowerCase().trim();

      const resp = await fetch(`${RESEND_BASE}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ name: cleanDomain, region }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return jsonResponse({ error: json?.message || "Resend create failed", resend: json }, { status: 502 });
      }
      const dnsRecords = json.records ?? [];
      const status = json.status ?? "pending";

      const { data: row, error } = await admin
        .from("email_domains")
        .upsert(
          {
            clinic_id,
            domain: cleanDomain,
            resend_domain_id: json.id,
            status,
            region,
            dns_records: dnsRecords,
            last_checked_at: new Date().toISOString(),
          },
          { onConflict: "clinic_id,domain" },
        )
        .select()
        .single();
      if (error) return jsonResponse({ error: error.message }, { status: 500 });
      return jsonResponse({ ok: true, domain: row });
    }

    if (action === "verify") {
      if (!domain_id) return jsonResponse({ error: "missing domain_id" }, { status: 400 });
      const { data: row } = await admin.from("email_domains").select("*").eq("id", domain_id).maybeSingle();
      if (!row?.resend_domain_id) return jsonResponse({ error: "domain not synced with Resend yet" }, { status: 400 });
      const RESEND_API_KEY = await resolveResendKey(admin, row.clinic_id, domain_id);
      if (!RESEND_API_KEY) return jsonResponse({ error: "Resend API key not configured for this clinic" }, { status: 503 });

      // Aciona verificação
      await fetch(`${RESEND_BASE}/domains/${row.resend_domain_id}/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      }).catch(() => {});

      // Busca status atualizado
      const resp = await fetch(`${RESEND_BASE}/domains/${row.resend_domain_id}`, {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return jsonResponse({ error: json?.message || "Resend fetch failed", resend: json }, { status: 502 });
      }
      const status = json.status ?? "pending";
      const dnsRecords = json.records ?? row.dns_records;
      const { data: updated } = await admin
        .from("email_domains")
        .update({ status, dns_records: dnsRecords, last_checked_at: new Date().toISOString() })
        .eq("id", domain_id)
        .select()
        .single();
      return jsonResponse({ ok: true, domain: updated });
    }

    if (action === "delete") {
      if (!domain_id) return jsonResponse({ error: "missing domain_id" }, { status: 400 });
      const { data: row } = await admin.from("email_domains").select("*").eq("id", domain_id).maybeSingle();
      if (row?.resend_domain_id) {
        await fetch(`${RESEND_BASE}/domains/${row.resend_domain_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        }).catch(() => {});
      }
      await admin.from("email_domains").delete().eq("id", domain_id);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    console.error("email-domain-manage error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});

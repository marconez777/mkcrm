// Edge Function: dispatch-campaign
// Resolve segmento da clínica e enfileira emails em lote.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    const isServiceRole = token === SERVICE_ROLE_KEY;

    let userId: string | null = null;
    if (!isServiceRole) {
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return jsonResponse({ error: "Unauthorized" }, { status: 401 });
      userId = u.user.id;
    }

    const body = await req.json().catch(() => ({}));
    const { campaign_id, test_only, test_email_override } = body ?? {};
    if (!campaign_id) return jsonResponse({ error: "missing campaign_id" }, { status: 400 });

    const { data: campaign, error: cErr } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .maybeSingle();
    if (cErr || !campaign) return jsonResponse({ error: cErr?.message || "campaign not found" }, { status: 404 });

    if (!isServiceRole && userId) {
      const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
      if (!isSuper) {
        const { data: mem } = await supabase
          .from("clinic_members")
          .select("role")
          .eq("user_id", userId)
          .eq("clinic_id", campaign.clinic_id)
          .in("role", ["owner", "admin"])
          .maybeSingle();
        if (!mem) return jsonResponse({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Normalize segment list (suporta múltiplos segmentos via segment_ids).
    const segmentIds: string[] = Array.isArray((campaign as any).segment_ids) && (campaign as any).segment_ids.length > 0
      ? ((campaign as any).segment_ids as string[]).filter(Boolean)
      : (campaign.segment_id ? [campaign.segment_id as string] : []);

    // === TEST MODE — não muda status, envia 1 email força ===
    if (test_only) {
      const dest = (test_email_override || campaign.test_email || "").trim();
      if (!dest) return jsonResponse({ error: "test_email missing" }, { status: 400 });

      // Variables sample (1º destinatário do 1º segmento via RPC)
      let s: { name: string | null } | undefined;
      if (segmentIds.length > 0) {
        const { data: resolved } = await supabase.rpc("resolve_email_segment", { _segment_id: segmentIds[0] });
        s = (resolved as any[])?.[0];
      }


      const { data: qid, error: qErr } = await supabase.rpc("enqueue_email", {
        _clinic_id: campaign.clinic_id,
        _template_slug: campaign.template_slug,
        _recipient_email: dest,
        _recipient_name: s?.name ?? "Teste",
        _variables: { name: s?.name ?? "Teste", campaign_id, test: true },
        _scheduled_at: new Date().toISOString(),
        _related_lead_id: null,
        _related_lead_table: `campaign_test_${campaign_id}`,
        _force_send: true,
        _from_name_override: campaign.from_name_override ?? null,
      });
      if (qErr) return jsonResponse({ error: qErr.message }, { status: 500 });

      await supabase.from("email_campaigns")
        .update({ test_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", campaign_id);

      // Dispara processamento imediato
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-email-queue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});

      return jsonResponse({ ok: true, test: true, queue_id: qid, to: dest });
    }

    if (campaign.status === "sent" || campaign.status === "sending") {
      return jsonResponse({ skipped: true, reason: "already_processing", status: campaign.status });
    }

    await supabase
      .from("email_campaigns")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", campaign_id);

    // R-4: Pre-checks (uma vez, antes de enfileirar)
    // 1) Feature gate
    const { data: hasFeat } = await supabase.rpc("clinic_has_feature", {
      _clinic_id: campaign.clinic_id, _key: "email_marketing",
    });
    if (!hasFeat) {
      await supabase.from("email_campaigns").update({
        status: "failed", error: "feature email_marketing disabled", updated_at: new Date().toISOString(),
      }).eq("id", campaign_id);
      return jsonResponse({ error: "feature_disabled" }, { status: 412 });
    }
    // 2) Template ativo
    const { data: tpl } = await supabase
      .from("email_templates")
      .select("id")
      .eq("clinic_id", campaign.clinic_id)
      .eq("slug", campaign.template_slug)
      .eq("active", true)
      .maybeSingle();
    if (!tpl) {
      await supabase.from("email_campaigns").update({
        status: "failed", error: "template not found or inactive", updated_at: new Date().toISOString(),
      }).eq("id", campaign_id);
      return jsonResponse({ error: "template_inactive" }, { status: 412 });
    }

    // G-05/G-29/F2.1: toda a resolução de público, dedup, variantes A/B,
    // rotação de domínio e throttling acontecem no banco, em uma transação.
    const { data: res, error: enqErr } = await supabase
      .rpc("enqueue_campaign_recipients", { _campaign_id: campaign_id });

    if (enqErr) {
      await supabase.from("email_campaigns").update({
        status: "failed",
        error: enqErr.message,
        updated_at: new Date().toISOString(),
      }).eq("id", campaign_id);
      console.error("enqueue_campaign_recipients error:", enqErr);
      return jsonResponse({ error: enqErr.message }, { status: 500 });
    }

    const enqueued = Number((res as any)?.enqueued ?? 0) || 0;

    await supabase
      .from("email_campaigns")
      .update({
        status: "sent",
        total_recipients: enqueued,
        enqueued_count: enqueued,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);


    // dispara processamento imediato (sem aguardar cron)
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-email-queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});

    return jsonResponse({ ok: true, total: enqueued, enqueued, status: "sent" });
  } catch (e) {
    console.error("dispatch-campaign error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});

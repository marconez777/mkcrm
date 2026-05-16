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
    if (token !== SERVICE_ROLE_KEY) {
      // permite chamada autenticada por admin via JWT
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return jsonResponse({ error: "Unauthorized" }, { status: 401 });
      const { data: isAdmin } = await supabase.rpc("is_clinic_admin", { _user_id: u.user.id });
      const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: u.user.id });
      if (!isAdmin && !isSuper) return jsonResponse({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { campaign_id } = body ?? {};
    if (!campaign_id) return jsonResponse({ error: "missing campaign_id" }, { status: 400 });

    const { data: campaign, error: cErr } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .maybeSingle();
    if (cErr || !campaign) return jsonResponse({ error: cErr?.message || "campaign not found" }, { status: 404 });
    if (campaign.status === "sent" || campaign.status === "sending") {
      return jsonResponse({ skipped: true, reason: "already_processing", status: campaign.status });
    }

    await supabase
      .from("email_campaigns")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", campaign_id);

    // Resolve recipients
    let recipients: Array<{ email: string; name: string | null; lead_id: string | null }> = [];

    if (campaign.test_email) {
      recipients = [{ email: campaign.test_email, name: null, lead_id: null }];
    } else {
      // Filtros mínimos: tags array, stage_id array (filtros JSONB)
      const filters = (campaign as any).segment_id
        ? (await supabase.from("email_segments").select("filters").eq("id", campaign.segment_id).maybeSingle()).data?.filters ?? {}
        : {};

      let q = supabase
        .from("leads")
        .select("id, name, email")
        .eq("clinic_id", campaign.clinic_id)
        .not("email", "is", null);
      if (Array.isArray(filters?.stage_ids) && filters.stage_ids.length) {
        q = q.in("stage_id", filters.stage_ids);
      }
      if (Array.isArray(filters?.tags) && filters.tags.length) {
        q = q.overlaps("tags", filters.tags);
      }
      const { data: leads } = await q.limit(10000);
      recipients = (leads ?? [])
        .filter((l: any) => l.email && /@/.test(l.email))
        .map((l: any) => ({ email: l.email, name: l.name, lead_id: l.id }));
    }

    let enqueued = 0;
    for (const r of recipients) {
      const { data: id } = await supabase.rpc("enqueue_email", {
        _clinic_id: campaign.clinic_id,
        _template_slug: campaign.template_slug,
        _recipient_email: r.email,
        _recipient_name: r.name,
        _variables: { name: r.name ?? "", campaign_id },
        _scheduled_at: new Date().toISOString(),
        _related_lead_id: r.lead_id,
        _related_lead_table: `campaign_${campaign_id}`,
        _force_send: false,
      });
      if (id) enqueued++;
    }

    await supabase
      .from("email_campaigns")
      .update({
        status: enqueued > 0 ? "sent" : "failed",
        total_recipients: recipients.length,
        enqueued_count: enqueued,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);

    return jsonResponse({ ok: true, total: recipients.length, enqueued });
  } catch (e) {
    console.error("dispatch-campaign error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});

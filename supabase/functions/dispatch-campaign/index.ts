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

    // === TEST MODE — não muda status, envia 1 email força ===
    if (test_only) {
      const dest = (test_email_override || campaign.test_email || "").trim();
      if (!dest) return jsonResponse({ error: "test_email missing" }, { status: 400 });

      // Variables sample (1º destinatário do segmento via RPC)
      let s: { name: string | null } | undefined;
      if (campaign.segment_id) {
        const { data: resolved } = await supabase.rpc("resolve_email_segment", { _segment_id: campaign.segment_id });
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

    // Resolve recipients
    let recipients: Array<{ email: string; name: string | null; lead_id: string | null }> = [];
    const seen = new Set<string>();
    const pushRec = (email: string, name: string | null, lead_id: string | null) => {
      const k = String(email).toLowerCase();
      if (!k || !/@/.test(k) || seen.has(k)) return;
      seen.add(k);
      recipients.push({ email: k, name, lead_id });
    };

    if (campaign.segment_id) {
      const { data: resolved, error: rErr } = await supabase.rpc("resolve_email_segment", { _segment_id: campaign.segment_id });
      if (rErr) console.error("resolve_email_segment error:", rErr);
      for (const r of ((resolved as any[]) ?? [])) pushRec(r?.email, r?.name ?? null, r?.lead_id ?? null);
    } else {
      // "Todos os leads" — inclui leads da clínica + todos os contatos manuais (com ou sem segmento)
      const { data: leads } = await supabase
        .from("leads")
        .select("id, email, name")
        .eq("clinic_id", campaign.clinic_id)
        .not("email", "is", null);
      for (const l of (leads ?? [])) pushRec((l as any).email ?? "", (l as any).name ?? null, (l as any).id ?? null);

      const { data: manual } = await supabase
        .from("email_segment_contacts")
        .select("email, name, lead_id")
        .eq("clinic_id", campaign.clinic_id);
      for (const c of (manual ?? [])) pushRec((c as any).email ?? "", (c as any).name ?? null, (c as any).lead_id ?? null);
    }


    // enqueue em paralelo (chunks) para não estourar tempo da edge function
    const CHUNK = 20;
    let enqueued = 0;
    for (let i = 0; i < recipients.length; i += CHUNK) {
      const chunk = recipients.slice(i, i + CHUNK);
      const results = await Promise.all(chunk.map((r) =>
        supabase.rpc("enqueue_email", {
          _clinic_id: campaign.clinic_id,
          _template_slug: campaign.template_slug,
          _recipient_email: r.email,
          _recipient_name: r.name,
          _variables: { name: r.name ?? "", campaign_id },
          _scheduled_at: new Date().toISOString(),
          _related_lead_id: r.lead_id,
          _related_lead_table: `campaign_${campaign_id}`,
          _force_send: false,
          _from_name_override: campaign.from_name_override ?? null,
        })
      ));
      enqueued += results.filter((r) => r.data).length;
    }

    // Campanha vazia ainda é "sent" — só "failed" se houver destinatários e nenhum enfileirou
    const finalStatus = recipients.length === 0
      ? "sent"
      : (enqueued > 0 ? "sent" : "failed");

    await supabase
      .from("email_campaigns")
      .update({
        status: finalStatus,
        total_recipients: recipients.length,
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

    return jsonResponse({ ok: true, total: recipients.length, enqueued, status: finalStatus });
  } catch (e) {
    console.error("dispatch-campaign error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});

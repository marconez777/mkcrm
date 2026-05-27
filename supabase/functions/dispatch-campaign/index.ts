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

    // Resolve recipients (com paginação para escalar >1000)
    let recipients: Array<{ email: string; name: string | null; lead_id: string | null }> = [];
    const seen = new Set<string>();
    const pushRec = (email: string, name: string | null, lead_id: string | null) => {
      const k = String(email ?? "").toLowerCase();
      if (!k || !/@/.test(k) || seen.has(k)) return;
      seen.add(k);
      recipients.push({ email: k, name, lead_id });
    };

    if (campaign.segment_id) {
      const { data: resolved, error: rErr } = await supabase.rpc("resolve_email_segment", { _segment_id: campaign.segment_id });
      if (rErr) console.error("resolve_email_segment error:", rErr);
      for (const r of ((resolved as any[]) ?? [])) pushRec(r?.email, r?.name ?? null, r?.lead_id ?? null);
    } else {
      // "Todos os leads" — paginar para suportar >1000 (limite default do PostgREST)
      const PAGE = 1000;
      for (let offset = 0; ; offset += PAGE) {
        const { data: leads, error } = await supabase
          .from("leads")
          .select("id, email, name")
          .eq("clinic_id", campaign.clinic_id)
          .not("email", "is", null)
          .order("id", { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (error) { console.error("leads page error:", error); break; }
        for (const l of (leads ?? [])) pushRec((l as any).email ?? "", (l as any).name ?? null, (l as any).id ?? null);
        if (!leads || leads.length < PAGE) break;
      }
      // contatos manuais (geralmente bem menor — uma página)
      for (let offset = 0; ; offset += PAGE) {
        const { data: manual, error } = await supabase
          .from("email_segment_contacts")
          .select("email, name, lead_id")
          .eq("clinic_id", campaign.clinic_id)
          .order("id", { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (error) { console.error("manual page error:", error); break; }
        for (const c of (manual ?? [])) pushRec((c as any).email ?? "", (c as any).name ?? null, (c as any).lead_id ?? null);
        if (!manual || manual.length < PAGE) break;
      }
    }


    // R-4: Pre-checks (uma vez, não por destinatário)
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

    // R-20: carrega variantes A/B (se houver)
    let variants: Array<{
      id: string;
      weight: number;
      subject_override: string | null;
      template_slug_override: string | null;
      from_name_override: string | null;
    }> = [];
    if ((campaign.variant_strategy ?? "none") !== "none") {
      const { data: vs } = await supabase
        .from("email_campaign_variants")
        .select("id, weight, subject_override, template_slug_override, from_name_override")
        .eq("campaign_id", campaign_id);
      variants = (vs as any[]) ?? [];
    }
    const totalWeight = variants.reduce((s, v) => s + Math.max(v.weight ?? 1, 1), 0);
    const pickVariant = (idx: number) => {
      if (!variants.length) return null;
      // round-robin ponderado determinístico
      const slot = idx % totalWeight;
      let acc = 0;
      for (const v of variants) {
        acc += Math.max(v.weight ?? 1, 1);
        if (slot < acc) return v;
      }
      return variants[0];
    };

    // R-18: throttling — espalha scheduled_at se send_rate_per_minute estiver definido
    const baseTime = Date.now();
    const ratePerMin = Number(campaign.send_rate_per_minute ?? 0) || 0;
    const scheduleFor = (idx: number) => {
      if (!ratePerMin || ratePerMin <= 0) return new Date(baseTime).toISOString();
      const minuteOffset = Math.floor(idx / ratePerMin);
      return new Date(baseTime + minuteOffset * 60_000).toISOString();
    };

    // R-4: batch INSERT em chunks grandes
    const fromOverrideBase = campaign.from_name_override ?? null;
    const fromDomainPool = (campaign.from_domain_pool ?? "").trim() || null;
    const relatedTable = `campaign_${campaign_id}`;
    const CHUNK = 1000;
    let enqueued = 0;

    // R-21 (O(1) por destinatário): carrega pool de domínios UMA VEZ
    // e distribui round-robin ponderado em memória — evita 1 RPC por contato.
    let rotationDomains: string[] = []; // já "expandido" por peso
    if (fromDomainPool) {
      const { data: pool } = await supabase
        .from("email_domains")
        .select("domain, rotation_weight, status")
        .eq("clinic_id", campaign.clinic_id)
        .eq("rotation_pool", fromDomainPool)
        .in("status", ["verified", "partially_verified"]);
      for (const d of (pool ?? []) as any[]) {
        const w = Math.max(parseInt(String(d.rotation_weight ?? 1), 10) || 1, 1);
        for (let k = 0; k < w; k++) rotationDomains.push(String(d.domain));
      }
      // shuffle leve pra não começar sempre pelo mesmo
      for (let i = rotationDomains.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rotationDomains[i], rotationDomains[j]] = [rotationDomains[j], rotationDomains[i]];
      }
    }
    const pickDomain = (idx: number): string | null =>
      rotationDomains.length ? rotationDomains[idx % rotationDomains.length] : null;

    for (let i = 0; i < recipients.length; i += CHUNK) {
      const chunk = recipients.slice(i, i + CHUNK);
      const rows = chunk.map((r, j) => {
        const globalIdx = i + j;
        const v = pickVariant(globalIdx);
        const slug = v?.template_slug_override || campaign.template_slug;
        const fromName = v?.from_name_override ?? fromOverrideBase;
        const fromDomainOverride = pickDomain(globalIdx);
        return {
          clinic_id: campaign.clinic_id,
          template_slug: slug,
          recipient_email: r.email,
          recipient_name: r.name,
          variables: { name: r.name ?? "", campaign_id, variant_id: v?.id ?? null, subject_override: v?.subject_override ?? null },
          scheduled_at: scheduleFor(globalIdx),
          related_lead_id: r.lead_id,
          related_lead_table: relatedTable,
          force_send: false,
          from_name_override: fromName,
          from_domain_override: fromDomainOverride,
          variant_id: v?.id ?? null,
          priority: 5,
          status: "pending",
        };
      });
      const { data: inserted, error: insErr } = await supabase
        .from("email_queue")
        .insert(rows)
        .select("id");
      if (insErr) {
        console.warn("batch insert error, falling back:", insErr.message);
        for (const row of rows) {
          const { data } = await supabase.rpc("enqueue_email", {
            _clinic_id: row.clinic_id,
            _template_slug: row.template_slug,
            _recipient_email: row.recipient_email,
            _recipient_name: row.recipient_name,
            _variables: row.variables,
            _scheduled_at: row.scheduled_at,
            _related_lead_id: row.related_lead_id,
            _related_lead_table: row.related_lead_table,
            _force_send: false,
            _from_name_override: row.from_name_override,
          });
          if (data) enqueued++;
        }
      } else {
        enqueued += inserted?.length ?? 0;
      }
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

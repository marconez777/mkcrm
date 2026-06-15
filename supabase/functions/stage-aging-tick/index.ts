// stage-aging-tick — cron diário.
// Cobre três regras temporais de pipeline que o field-rules-tick (avaliação
// instantânea de custom_fields) não enxerga:
//
//   B18  Coluna "Procedimento pago" sem regra de envelhecimento.
//        Lead em "Procedimento pago" sem nova mensagem há ≥ 60 dias →
//        move para "Nutrição de Leads Inativos".
//
//   D1   Gatilho "Retorno Tratamento Finalizado".
//        Lead com tipo_atendimento ∈ {sessao_emt, sessao_cetamina} em
//        "Consulta finalizada" / "Procedimento pago" há ≥ 30 dias E
//        sem mensagem (inbound ou outbound real) há ≥ 60 dias →
//        move para "Retorno Tratamento Finalizado".
//
//   D3   Auto-transição de status_consulta.
//        custom_fields.status_consulta='agendada' e
//        custom_fields.consulta_agendada_em < now() → status='realizada'.
//        (Não move stage — isso fica para field-rules baseadas em status_consulta
//        e/ou ação manual de no-show no LeadDrawer.)
//
// Regras gerais:
//   - respeita leads.is_internal_contact = true → pula.
//   - respeita pipeline_stages.lock_auto_move → pula (entrada e saída).
//   - respeita manual_lock_until.
//   - registra cada movimento em lead_stage_history (reason='stage_aging:<rule>')
//     e dispara lead_events.type='stage_auto_moved'.
//
// Trigger: cron diário (03:30 BRT) OU POST manual { clinic_id?, dry_run? }.

import { corsHeaders, json, sb } from "../_shared/evolution.ts";

const PROC_PAGO_INACTIVE_DAYS = 60;        // B18
const RETORNO_STAGE_DAYS = 30;             // D1 — tempo na stage de finalização
const RETORNO_NO_MSG_DAYS = 60;            // D1 — tempo sem mensagem
const MAX_LEADS_PER_CLINIC = 1000;

interface StageMap {
  byName: Map<string, { id: string; lock: boolean }>;
}

async function loadStages(supabase: ReturnType<typeof sb>, clinicId: string): Promise<StageMap> {
  const { data } = await supabase
    .from("pipeline_stages")
    .select("id, name, lock_auto_move, pipeline_id, pipelines!inner(clinic_id)")
    .eq("pipelines.clinic_id", clinicId);
  const byName = new Map<string, { id: string; lock: boolean }>();
  for (const s of (data ?? []) as Array<{ id: string; name: string; lock_auto_move: boolean | null }>) {
    if (!byName.has(s.name)) byName.set(s.name, { id: s.id, lock: !!s.lock_auto_move });
  }
  return { byName };
}

interface LeadRow {
  id: string;
  clinic_id: string;
  stage_id: string | null;
  custom_fields: Record<string, unknown> | null;
  manual_lock_until: string | null;
  last_message_at: string | null;
  is_internal_contact: boolean | null;
}

async function moveLead(
  supabase: ReturnType<typeof sb>,
  lead: LeadRow,
  toStageId: string,
  rule: string,
  dryRun: boolean,
): Promise<boolean> {
  if (dryRun) return true;
  const { error } = await supabase.from("leads").update({ stage_id: toStageId }).eq("id", lead.id);
  if (error) return false;
  // B7 (Onda 6): em vez de inserir uma 2ª linha, atualiza a linha que o trigger
  // record_lead_stage_history acabou de criar (mais recente pra este lead).
  const { data: latest } = await supabase
    .from("lead_stage_history")
    .select("id")
    .eq("lead_id", lead.id)
    .order("moved_at", { ascending: false })
    .limit(1);
  const rowId = (latest?.[0] as { id?: string } | undefined)?.id;
  if (rowId) {
    await supabase.from("lead_stage_history").update({
      reason: `stage_aging:${rule}`,
      source: "stage_aging_tick",
      metadata: { rule, function: "stage-aging-tick", at: new Date().toISOString() },
    }).eq("id", rowId);
  }
  await supabase.from("lead_events").insert({
    clinic_id: lead.clinic_id,
    lead_id: lead.id,
    type: "stage_auto_moved",
    payload: {
      rule: `stage_aging:${rule}`,
      from_stage_id: lead.stage_id,
      to_stage_id: toStageId,
      at: new Date().toISOString(),
    },
  });
  return true;
}

async function processClinic(clinicId: string, dryRun: boolean) {
  const supabase = sb();
  const stages = await loadStages(supabase, clinicId);

  const stageProcPago = stages.byName.get("Procedimento pago");
  const stageConsultaFin = stages.byName.get("Consulta finalizada");
  const stageNutricao = stages.byName.get("Nutrição de Leads Inativos");
  const stageRetorno = stages.byName.get("Retorno Tratamento Finalizado");

  const now = Date.now();
  const cutoff60 = new Date(now - PROC_PAGO_INACTIVE_DAYS * 86400000).toISOString();
  const cutoffNoMsg = new Date(now - RETORNO_NO_MSG_DAYS * 86400000).toISOString();
  const cutoffStage = new Date(now - RETORNO_STAGE_DAYS * 86400000).toISOString();

  const results = { b18: 0, d1: 0, d3: 0, skipped: 0, scanned: 0 };

  // --- B18: Procedimento pago inativo > 60d ---
  if (stageProcPago && !stageProcPago.lock && stageNutricao && !stageNutricao.lock) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, clinic_id, stage_id, custom_fields, manual_lock_until, last_message_at, is_internal_contact")
      .eq("clinic_id", clinicId)
      .eq("stage_id", stageProcPago.id)
      .or(`last_message_at.is.null,last_message_at.lt.${cutoff60}`)
      .limit(MAX_LEADS_PER_CLINIC);
    for (const lead of (leads ?? []) as LeadRow[]) {
      results.scanned++;
      if (lead.is_internal_contact) { results.skipped++; continue; }
      if (lead.manual_lock_until && new Date(lead.manual_lock_until).getTime() > now) { results.skipped++; continue; }
      if (await moveLead(supabase, lead, stageNutricao.id, "B18_proc_pago_60d", dryRun)) results.b18++;
    }
  }

  // --- D1: Retorno Tratamento Finalizado ---
  if (stageRetorno && !stageRetorno.lock) {
    const sourceStages = [stageProcPago, stageConsultaFin].filter(Boolean).map((s) => s!.id);
    if (sourceStages.length > 0) {
      // tempo na stage: histórico mais recente para esse lead naqueles target_stage_ids
      const { data: hist } = await supabase
        .from("lead_stage_history")
        .select("lead_id, to_stage_id, created_at")
        .eq("clinic_id", clinicId)
        .in("to_stage_id", sourceStages)
        .lt("created_at", cutoffStage)
        .order("created_at", { ascending: false })
        .limit(MAX_LEADS_PER_CLINIC);
      const leadIds = Array.from(new Set((hist ?? []).map((r: any) => r.lead_id as string)));
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, clinic_id, stage_id, custom_fields, manual_lock_until, last_message_at, is_internal_contact")
          .in("id", leadIds)
          .in("stage_id", sourceStages);
        for (const lead of (leads ?? []) as LeadRow[]) {
          results.scanned++;
          if (lead.is_internal_contact) { results.skipped++; continue; }
          if (lead.manual_lock_until && new Date(lead.manual_lock_until).getTime() > now) { results.skipped++; continue; }
          const tipo = (lead.custom_fields ?? {})["tipo_atendimento"];
          if (tipo !== "sessao_emt" && tipo !== "sessao_cetamina") { results.skipped++; continue; }
          if (lead.last_message_at && lead.last_message_at >= cutoffNoMsg) { results.skipped++; continue; }
          if (await moveLead(supabase, lead, stageRetorno.id, "D1_retorno_tratamento", dryRun)) results.d1++;
        }
      }
    }
  }

  // --- D3: status_consulta agendada → realizada quando data passou ---
  // Faz na mão (jsonb merge) para não perder os demais custom_fields.
  const { data: pendentes } = await supabase
    .from("leads")
    .select("id, clinic_id, custom_fields, is_internal_contact")
    .eq("clinic_id", clinicId)
    .eq("custom_fields->>status_consulta", "agendada")
    .not("custom_fields->>consulta_agendada_em", "is", null)
    .limit(MAX_LEADS_PER_CLINIC);
  for (const lead of (pendentes ?? []) as Array<{ id: string; custom_fields: Record<string, unknown> | null; is_internal_contact: boolean | null }>) {
    results.scanned++;
    if (lead.is_internal_contact) { results.skipped++; continue; }
    const cf = lead.custom_fields ?? {};
    const dt = cf["consulta_agendada_em"];
    if (typeof dt !== "string" || !dt) { results.skipped++; continue; }
    const ts = Date.parse(dt);
    if (!isFinite(ts) || ts >= now) { results.skipped++; continue; }
    if (dryRun) { results.d3++; continue; }
    const nextCf = { ...cf, status_consulta: "realizada" };
    const { error } = await supabase.from("leads").update({ custom_fields: nextCf }).eq("id", lead.id);
    if (!error) {
      results.d3++;
      await supabase.from("lead_events").insert({
        clinic_id: clinicId,
        lead_id: lead.id,
        type: "custom_field_auto_set",
        payload: {
          rule: "stage_aging:D3_status_consulta",
          field: "status_consulta",
          value: "realizada",
          at: new Date(now).toISOString(),
        },
      });
    }
  }

  return { clinic_id: clinicId, ...results };
}

interface Body {
  clinic_id?: string;
  dry_run?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* cron sem body */ }
  }

  const supabase = sb();
  let cq = supabase.from("clinics").select("id");
  if (body.clinic_id) cq = cq.eq("id", body.clinic_id);
  const { data: clinics, error } = await cq;
  if (error) return json({ error: error.message }, 500);

  const dryRun = !!body.dry_run;
  const results: unknown[] = [];
  for (const c of (clinics ?? []) as Array<{ id: string }>) {
    try {
      results.push(await processClinic(c.id, dryRun));
    } catch (e) {
      results.push({ clinic_id: c.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({ ok: true, dry_run: dryRun, results });
});

// field-rules-tick — cron 2 min.
// Avalia regras de `pipeline_field_rules` por clínica e move automaticamente
// os cards (leads.stage_id) quando os custom_fields baterem nas condições.
//
// Salvaguardas:
//   - respeita manual_lock_until: se o lead estiver com lock manual, pula
//   - apenas leads atualizados nas últimas 24h (limite 500/clínica)
//   - regras avaliadas em ordem de priority DESC; primeira que casar vence
//   - se a regra aponta pra mesma stage atual, nada acontece
//   - registra a mudança em lead_stage_history com reason='field_rule:<nome>'
//   - dispara lead_events.type='stage_auto_moved'
//
// Trigger via cron OU POST manual (force=true, clinic_id, lead_ids).

import { corsHeaders, json, sb } from "../_shared/evolution.ts";
import { parseFutureDate } from "../_shared/dates.ts";

type Op =
  | "equals" | "not_equals" | "is_true" | "is_false"
  | "is_empty" | "not_empty" | "in" | "contains"
  | "gte" | "lte" | "is_future" | "is_past";

interface Condition {
  field: string;        // chave em custom_fields. Suporta dot.path raso.
  op: Op;
  value?: unknown;
}

interface Rule {
  id: string;
  pipeline_id: string;
  target_stage_id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: Condition[] | null;
}

export function getField(cf: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: any = cf;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function evalCondition(cf: Record<string, unknown>, c: Condition): boolean {
  const v = getField(cf, c.field);
  switch (c.op) {
    case "equals": return v === c.value;
    case "not_equals": return v !== c.value;
    case "is_true": return v === true;
    case "is_false": return v === false;
    case "is_empty": return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    case "not_empty": return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
    case "in": return Array.isArray(c.value) && (c.value as unknown[]).includes(v as never);
    case "contains":
      return typeof v === "string" && typeof c.value === "string" &&
        v.toLowerCase().includes((c.value as string).toLowerCase());
    case "gte": return typeof v === "number" && typeof c.value === "number" && v >= c.value;
    case "lte": return typeof v === "number" && typeof c.value === "number" && v <= c.value;
    case "is_future": return parseFutureDate(v) !== null;
    case "is_past": {
      if (typeof v !== "string" || !v) return false;
      const t = Date.parse(v);
      return !isNaN(t) && t < Date.now();
    }
    default: return false;
  }
}

export function matches(cf: Record<string, unknown>, rule: Rule): boolean {
  const conds = rule.conditions ?? [];
  if (conds.length === 0) return false; // regra sem condição não casa nada
  return conds.every((c) => evalCondition(cf, c));
}

interface LeadRow {
  id: string;
  clinic_id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  custom_fields: Record<string, unknown> | null;
  manual_lock_until: string | null;
  updated_at: string;
}

async function processClinic(clinicId: string, leadIds?: string[], allInPipeline?: string) {
  const supabase = sb();

  // 1) regras enabled da clínica, agrupadas por pipeline_id
  const { data: rulesRaw } = await supabase
    .from("pipeline_field_rules")
    .select("id, pipeline_id, target_stage_id, name, priority, enabled, conditions")
    .eq("clinic_id", clinicId)
    .eq("enabled", true)
    .order("priority", { ascending: false });

  const rules = (rulesRaw ?? []) as Rule[];
  if (rules.length === 0) return { clinic_id: clinicId, moved: 0, evaluated: 0 };

  // 1.1) etapas travadas (lock_auto_move) — para bloquear saída E entrada automática
  const { data: stagesRaw } = await supabase
    .from("pipeline_stages")
    .select("id, lock_auto_move")
    .eq("clinic_id", clinicId);
  const lockedStageIds = new Set(
    (stagesRaw ?? []).filter((s: any) => s.lock_auto_move).map((s: any) => s.id as string),
  );

  const rulesByPipeline = new Map<string, Rule[]>();
  for (const r of rules) {
    // Pula regras que tentam mover PARA uma etapa travada
    if (lockedStageIds.has(r.target_stage_id)) continue;
    const arr = rulesByPipeline.get(r.pipeline_id) ?? [];
    arr.push(r);
    rulesByPipeline.set(r.pipeline_id, arr);
  }

  if (rulesByPipeline.size === 0) return { clinic_id: clinicId, moved: 0, evaluated: 0 };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const pipelineIds = Array.from(rulesByPipeline.keys());
  const forced = !!(leadIds && leadIds.length);

  let leads: LeadRow[] = [];
  if (allInPipeline) {
    let off = 0;
    while (true) {
      const { data, error } = await supabase
        .from("leads")
        .select("id, clinic_id, pipeline_id, stage_id, custom_fields, manual_lock_until, updated_at")
        .eq("clinic_id", clinicId)
        .eq("pipeline_id", allInPipeline)
        .order("id", { ascending: true })
        .range(off, off + 499);
      if (error) return { clinic_id: clinicId, error: error.message };
      if (!data || data.length === 0) break;
      leads.push(...(data as LeadRow[]));
      if (data.length < 500) break;
      off += 500;
    }
  } else {
    const leadsQ = supabase
      .from("leads")
      .select("id, clinic_id, pipeline_id, stage_id, custom_fields, manual_lock_until, updated_at")
      .eq("clinic_id", clinicId)
      .in("pipeline_id", pipelineIds)
      .order("updated_at", { ascending: false })
      .limit(forced ? Math.max(500, leadIds!.length) : 500);
    if (!forced) leadsQ.gte("updated_at", since);
    if (forced) leadsQ.in("id", leadIds!);
    const { data, error } = await leadsQ;
    if (error) return { clinic_id: clinicId, error: error.message };
    leads = (data ?? []) as LeadRow[];
  }

  let moved = 0;
  let evaluated = 0;
  let skipped = 0;
  const now = new Date();
  const nowIso = now.toISOString();

  for (const lead of (leads ?? []) as LeadRow[]) {
    evaluated++;

    if (lead.manual_lock_until && new Date(lead.manual_lock_until) > now) {
      skipped++;
      continue;
    }
    if (!lead.pipeline_id) continue;

    // Pula leads em etapas travadas (ex.: Administrativo)
    if (lead.stage_id && lockedStageIds.has(lead.stage_id)) {
      skipped++;
      continue;
    }

    const pipelineRules = rulesByPipeline.get(lead.pipeline_id) ?? [];
    const cf = (lead.custom_fields ?? {}) as Record<string, unknown>;

    let matched: Rule | null = null;
    for (const r of pipelineRules) {
      if (matches(cf, r)) { matched = r; break; }
    }
    if (!matched) continue;
    if (matched.target_stage_id === lead.stage_id) continue;

    const fromStage = lead.stage_id;

    const { error: updErr } = await supabase
      .from("leads")
      .update({ stage_id: matched.target_stage_id })
      .eq("id", lead.id);

    if (updErr) {
      skipped++;
      continue;
    }

    // B7 (Onda 6): atualiza a linha que o trigger record_lead_stage_history
    // acabou de criar (em vez de inserir 2ª linha duplicada).
    const { data: latest } = await supabase
      .from("lead_stage_history")
      .select("id")
      .eq("lead_id", lead.id)
      .order("moved_at", { ascending: false })
      .limit(1);
    const rowId = (latest?.[0] as { id?: string } | undefined)?.id;
    if (rowId) {
      await supabase.from("lead_stage_history").update({
        reason: `field_rule:${matched.name}`,
        source: "field_rules_tick",
        metadata: {
          rule_id: matched.id,
          rule_name: matched.name,
          function: "field-rules-tick",
          at: nowIso,
        },
      }).eq("id", rowId);
    }

    await supabase.from("lead_events").insert({
      clinic_id: clinicId,
      lead_id: lead.id,
      type: "stage_auto_moved",
      payload: {
        rule_id: matched.id,
        rule_name: matched.name,
        from_stage_id: fromStage,
        to_stage_id: matched.target_stage_id,
        at: nowIso,
      },
    });

    moved++;
  }

  return { clinic_id: clinicId, moved, evaluated, skipped };
}

interface Body {
  clinic_id?: string;
  lead_ids?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* cron sem body */ }
  }

  const supabase = sb();

  // Lista clínicas com pelo menos 1 regra enabled
  let cq = supabase
    .from("pipeline_field_rules")
    .select("clinic_id")
    .eq("enabled", true);
  if (body.clinic_id) cq = cq.eq("clinic_id", body.clinic_id);

  const { data: clinicRows, error } = await cq;
  if (error) return json({ error: error.message }, 500);

  const clinicIds = Array.from(new Set((clinicRows ?? []).map((r: any) => r.clinic_id)));
  const results: any[] = [];
  for (const cid of clinicIds) {
    const r = await processClinic(cid, body.lead_ids);
    results.push(r);
  }

  return json({ ok: true, results });
});

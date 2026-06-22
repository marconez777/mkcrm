// supabase/functions/pipeline-position-auditor/index.ts
//
// Marco 2.5 — A1 (auditor de posição).
//
// Cron diário (03:00 BRT). Para cada lead parado ≥7d em stages ativos sem
// appointment futuro e não desqualificado, roda o mesmo prompt do classifier
// em modo "revisor". Se sugerir stage diferente com confidence ≥0.75:
//   - tags `precisa_atencao_humana` + `auditor_sugere_<canon>`
//   - cria lead_task "Revisar posição: auditor sugere <X>" due_at=+2d
//   - grava lead_event `position_audit_disagreement`
// Caso contrário: lead_event `position_audit_ok` (silencioso).
//
// Idempotência: 1 auditoria por lead a cada 14 dias (lead_events lookup).
// Batch: 50/dia (toggle automation.position_auditor.batch_size).
// NUNCA move card. NUNCA toca em appointments (G11).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getClinicOpenAI } from "../_shared/clinic-openai.ts";
import { isClinicPipelineAllowed } from "../_shared/pipeline-allowlist.ts";
import { generateText, Output, stepCountIs } from "npm:ai@^6";
import { z } from "npm:zod@^3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "gpt-5-mini";
const DEFAULT_BATCH = 50;
const MAX_MSGS = 30;

// P16+P17: stages a EXCLUIR resolvidos por nome canônico via
// stage_canonical_aliases (em vez de comparação literal de stage.name).
// Antes: hardcoded "Nutrição inativa" (i minúsculo) e "Em tratamento"
// (stage fantasma) — não batiam com nomes reais da clínica
// (ex.: "Nutrição Inativa (Geladeira de Leads)").
const EXCLUDED_CANONICALS = new Set<string>([
  "Paciente antigo",
  "B2B / Stakeholders",
  "Nutrição inativa",
  "nutricao_inativa",
  "geladeira_de_leads",
  "Nutrição Antigos",
  "nutricao_antigos",
]);

async function loadExcludedStageIds(client: SupabaseClient): Promise<Set<string>> {
  const { data } = await client
    .from("stage_canonical_aliases")
    .select("stage_id, canonical_name")
    .in("canonical_name", Array.from(EXCLUDED_CANONICALS));
  const out = new Set<string>();
  for (const row of data ?? []) {
    if (row.stage_id) out.add(row.stage_id as string);
  }
  return out;
}


type Canon =
  | "Novo"
  | "Qualificação"
  | "Consulta agendada"
  | "Tratamento agendado"
  | "Consulta finalizada"
  | "Em tratamento"
  | "Sem resposta"
  | "Nutrição inativa"
  | "Paciente antigo"
  | "B2B / Stakeholders";

const CANON_NAMES: Canon[] = [
  "Novo",
  "Qualificação",
  "Consulta agendada",
  "Tratamento agendado",
  "Consulta finalizada",
  "Em tratamento",
  "Sem resposta",
  "Nutrição inativa",
  "Paciente antigo",
  "B2B / Stakeholders",
];

const AuditSchema = z.object({
  stage_suggestion: z.enum([
    "Novo",
    "Qualificação",
    "Consulta agendada",
    "Tratamento agendado",
    "Consulta finalizada",
    "Em tratamento",
    "Sem resposta",
    "Nutrição inativa",
    "Paciente antigo",
    "B2B / Stakeholders",
  ]),
  confidence: z.number().min(0).max(1),
  agrees_with_current: z.boolean(),
  reasoning: z.string().max(400),
});

async function isEnabled(client: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return false;
  const v = String(data.value).toLowerCase();
  return v === "true" || v === "1" || v === '"true"';
}

async function getBatchSize(client: SupabaseClient): Promise<number> {
  const { data } = await client
    .from("app_settings")
    .select("value")
    .eq("key", "automation.position_auditor.batch_size")
    .maybeSingle();
  if (!data) return DEFAULT_BATCH;
  const n = parseInt(String(data.value).replace(/"/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : DEFAULT_BATCH;
}

async function addTags(client: SupabaseClient, leadId: string, tags: string[]) {
  const { data: lead } = await client.from("leads").select("tags").eq("id", leadId).single();
  const current: string[] = lead?.tags ?? [];
  const merged = Array.from(new Set([...current, ...tags]));
  if (merged.length === current.length) return;
  await client.from("leads").update({ tags: merged }).eq("id", leadId);
}

function formatMessages(msgs: Array<{ from_me: boolean; content: string | null; created_at: string }>): string {
  return msgs
    .map((m) => `[${m.created_at.slice(0, 16)}] ${m.from_me ? "ATENDENTE" : "LEAD"}: ${(m.content ?? "").slice(0, 500)}`)
    .join("\n");
}

function buildSystemPrompt(currentStageName: string): string {
  return `Você é um auditor de posição de pipeline de CRM médico (revisor de segunda opinião).
Receberá o histórico de um lead que está PARADO há mais de 7 dias na coluna "${currentStageName}".
Sua tarefa: dizer se essa posição AINDA é correta, ou se já deveria estar em outra coluna.

Pipeline canônico v4.2 (use exatamente estes nomes em stage_suggestion):
${CANON_NAMES.map((n) => `- ${n}`).join("\n")}

Regras:
- agrees_with_current=true se "${currentStageName}" continua sendo o stage adequado.
- agrees_with_current=false só se o histórico evidencia transição clara (ex: consulta marcada, lead desistiu, virou paciente antigo).
- confidence reflete sua certeza. Use ≤ 0.6 quando o histórico for ambíguo.
- reasoning: 1 parágrafo curto em PT-BR justificando.
- NUNCA sugira mover por mera intuição — exige evidência textual.`;
}

interface AuditCandidate {
  id: string;
  clinic_id: string;
  pipeline_id: string;
  stage_id: string;
  stage_name: string;
  stage_changed_at: string;
}

async function selectCandidates(client: SupabaseClient, batchSize: number): Promise<AuditCandidate[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString();

  // 1) Leads candidatos por critério temporal + stage não excluído + não desqualificado.
  const { data: leads, error } = await client
    .from("leads")
    .select("id, clinic_id, pipeline_id, stage_id, stage_changed_at, custom_fields, pipeline_stages!leads_stage_id_fkey(name)")
    .lt("stage_changed_at", sevenDaysAgo)
    .not("stage_id", "is", null)
    .not("pipeline_id", "is", null)
    .limit(batchSize * 5);
  if (error) throw new Error(`select_leads:${error.message}`);

  const filtered: AuditCandidate[] = [];
  for (const l of leads ?? []) {
    const stageName = (l as Record<string, unknown>).pipeline_stages as { name?: string } | null;
    const name = stageName?.name ?? "";
    if (EXCLUDED_STAGES.has(name)) continue;
    const cf = (l as { custom_fields?: Record<string, unknown> }).custom_fields ?? {};
    if (cf?.qualificacao === "desqualificado") continue;

    // Já auditado nos últimos 14d? (idempotência)
    const { data: prior } = await client
      .from("lead_events")
      .select("id")
      .eq("lead_id", l.id as string)
      .in("type", ["position_audit_ok", "position_audit_disagreement"])
      .gte("created_at", fourteenDaysAgo)
      .limit(1)
      .maybeSingle();
    if (prior) continue;

    // Tem appointment futuro?
    const { data: futureAppt } = await client
      .from("appointments")
      .select("id")
      .eq("lead_id", l.id as string)
      .gt("scheduled_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (futureAppt) continue;

    filtered.push({
      id: l.id as string,
      clinic_id: l.clinic_id as string,
      pipeline_id: l.pipeline_id as string,
      stage_id: l.stage_id as string,
      stage_name: name,
      stage_changed_at: l.stage_changed_at as string,
    });
    if (filtered.length >= batchSize) break;
  }
  return filtered;
}

async function auditOne(client: SupabaseClient, c: AuditCandidate) {
  if (!(await isClinicPipelineAllowed(client, c.clinic_id))) {
    return { skipped: "clinic_not_allowlisted" };
  }
  const { data: msgs } = await client
    .from("messages")
    .select("id, from_me, content, created_at")
    .eq("lead_id", c.id)
    .order("created_at", { ascending: false })
    .limit(MAX_MSGS);
  const ordered = (msgs ?? []).reverse();
  if (ordered.length === 0) return { skipped: "no_messages" };

  const ai = await getClinicOpenAI(client, c.clinic_id);
  if (!ai) return { skipped: "no_clinic_openai_key" };

  const { output } = await generateText({
    model: ai.model(MODEL),
    system: buildSystemPrompt(c.stage_name),
    prompt:
      `Lead id=${c.id}\n` +
      `Stage atual: "${c.stage_name}"\n` +
      `Parado desde: ${c.stage_changed_at}\n\n` +
      `Histórico (últimas ${ordered.length} mensagens):\n${formatMessages(ordered)}\n\nAudite agora.`,
    output: Output.object({ schema: AuditSchema }),
    stopWhen: stepCountIs(5),
  });
  const audit = output as z.infer<typeof AuditSchema>;

  const disagree =
    !audit.agrees_with_current &&
    audit.stage_suggestion !== c.stage_name &&
    audit.confidence >= 0.75;

  if (disagree) {
    await addTags(client, c.id, [
      "precisa_atencao_humana",
      `auditor_sugere_${audit.stage_suggestion.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`,
    ]);
    await client.from("lead_tasks").insert({
      lead_id: c.id,
      clinic_id: c.clinic_id,
      title: `Revisar posição: auditor sugere mover para "${audit.stage_suggestion}" (conf ${audit.confidence.toFixed(2)})`,
      due_at: new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString(),
    });
    await client.from("lead_events").insert({
      clinic_id: c.clinic_id,
      lead_id: c.id,
      type: "position_audit_disagreement",
      payload: {
        from_stage: c.stage_name,
        to_stage: audit.stage_suggestion,
        confidence: audit.confidence,
        reasoning: audit.reasoning,
      },
    });
    return { disagree: true, audit };
  }

  await client.from("lead_events").insert({
    clinic_id: c.clinic_id,
    lead_id: c.id,
    type: "position_audit_ok",
    payload: {
      stage: c.stage_name,
      confidence: audit.confidence,
      agrees_with_current: audit.agrees_with_current,
    },
  });
  return { disagree: false, audit };
}

async function tick(client: SupabaseClient) {
  if (!(await isEnabled(client, "automation.position_auditor.enabled"))) {
    return { skipped: "toggle_off" };
  }
  const batchSize = await getBatchSize(client);
  const candidates = await selectCandidates(client, batchSize);
  const results: Array<Record<string, unknown>> = [];
  for (const c of candidates) {
    try {
      const r = await auditOne(client, c);
      results.push({ lead_id: c.id, ok: true, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("audit failed", c.id, msg);
      results.push({ lead_id: c.id, ok: false, error: msg });
    }
  }
  return { audited: results.length, batch_size: batchSize, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    let result: unknown;
    if (body.action === "lead" && body.lead_id) {
      const { data: l } = await client
        .from("leads")
        .select("id, clinic_id, pipeline_id, stage_id, stage_changed_at, pipeline_stages!leads_stage_id_fkey(name)")
        .eq("id", body.lead_id)
        .single();
      if (!l) throw new Error("lead_not_found");
      const stageName = ((l as Record<string, unknown>).pipeline_stages as { name?: string } | null)?.name ?? "";
      result = await auditOne(client, {
        id: l.id as string,
        clinic_id: l.clinic_id as string,
        pipeline_id: l.pipeline_id as string,
        stage_id: l.stage_id as string,
        stage_name: stageName,
        stage_changed_at: l.stage_changed_at as string,
      });
    } else {
      result = await tick(client);
    }
    console.log(JSON.stringify({ fn: "position-auditor", result }));
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("position-auditor error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

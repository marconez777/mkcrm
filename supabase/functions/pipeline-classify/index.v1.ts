// supabase/functions/pipeline-classify/index.ts
//
// Marco 2 — Classifier LLM para pipeline v4.2.
//
// Lê o histórico recente do lead (desde last_processed_message_id_classifier) e
// devolve um JSON estruturado com:
//   - stage_suggestion (canon name)
//   - confidence ∈ [0,1]
//   - is_b2b (boolean)
//   - tags_suggested (string[])
//   - custom_fields_patch (object)
//   - reasons (string[])
//
// Comportamento:
//   - SEMPRE grava lead_events 'auto:classifier' com payload completo.
//   - Atualiza last_processed_message_id_classifier no fim.
//   - confidence < 0.6 → tag `precisa_atencao_humana`.
//   - is_b2b=true + automation.b2b_move.enabled + confidence ≥ 0.9 → move para
//     "B2B / Stakeholders" via pipelineMove (gate G3 já aplicado por toggle).
//   - NUNCA move para stage_suggestion automaticamente — isso é função dos
//     auditores no Marco 2.5.
//
// Tool A3 (opcional, gateada por automation.classifier.history_tool_enabled):
//   - `get_lead_history(lead_id)` — devolve resumos curtos dos últimos eventos
//     e classificações pra dar mais contexto quando o snippet recente não basta.
//
// Acessada por:
//   - Cron `pipeline-classify-tick` (a cada 1 min) → action=tick (processa fila)
//   - Invocação manual com action=lead + lead_id (smoke test)

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { generateText, tool, Output, stepCountIs } from "npm:ai@^6";
import { z } from "npm:zod@^3";
import { pipelineMove } from "../_shared/pipeline-move.ts";
import { runSummarize } from "../_shared/pipeline-summarize-core.ts";
import { runNfTask, runPaymentAlleged } from "../_shared/pipeline-tasks.ts";
import { runJudicializacao, runRenovacaoReceita, runObjectionSuggest } from "../_shared/pipeline-fase4.ts";
import { getClinicOpenAI } from "../_shared/clinic-openai.ts";
import { isClinicPipelineAllowed } from "../_shared/pipeline-allowlist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "gpt-5-mini";
const BATCH_LIMIT = 50;
const MAX_MSGS = 30;

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

const INTENT_VALUES = [
  "agendamento",
  "reagendamento",
  "duvida_geral",
  "nf_reembolso",
  "pagamento_alegado",
  "desistencia",
  "interesse_tratamento",
  "judicializacao",
  "renovacao_receita",
  "objecao",
  "outro",
] as const;

const ClassificationSchema = z.object({
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
  intent: z.enum(INTENT_VALUES).default("outro"),
  confidence: z.number().min(0).max(1),
  is_b2b: z.boolean(),
  tags_suggested: z.array(z.string()).max(8),
  tags_remove: z.array(z.string()).max(8).default([]),
  custom_fields_patch: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  reasons: z.array(z.string()).min(1).max(5),
});

// Tags que NUNCA podem ser removidas por automação (humano-only).
const PROTECTED_TAGS = new Set([
  "risco_clinico",
  "b2b",
  "vip",
  "paciente_antigo",
  "precisa_atencao_humana",
  "Lock manual",
  "lock_manual",
]);

async function getSettingNumber(client: SupabaseClient, key: string, fallback: number): Promise<number> {
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return fallback;
  const n = Number(String(data.value).replace(/"/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

type Classification = z.infer<typeof ClassificationSchema>;

async function isEnabled(client: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return false;
  const v = String(data.value).toLowerCase();
  return v === "true" || v === "1" || v === '"true"';
}

async function resolveStageId(
  client: SupabaseClient,
  clinicId: string,
  pipelineId: string,
  canonical: Canon,
): Promise<string | null> {
  const { data } = await client
    .from("stage_canonical_aliases")
    .select("stage_id")
    .eq("clinic_id", clinicId)
    .eq("pipeline_id", pipelineId)
    .eq("canonical_name", canonical)
    .maybeSingle();
  return (data?.stage_id as string) ?? null;
}

async function addTag(client: SupabaseClient, leadId: string, tag: string) {
  const { data: lead } = await client.from("leads").select("tags").eq("id", leadId).single();
  const current: string[] = lead?.tags ?? [];
  if (current.includes(tag)) return;
  await client.from("leads").update({ tags: [...current, tag] }).eq("id", leadId);
}

const BR_TZ = "America/Sao_Paulo";

function fmtBR(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: BR_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso.slice(0, 16);
  }
}

function ageHuman(fromIso: string, nowMs: number): string {
  const t = Date.parse(fromIso);
  if (!Number.isFinite(t)) return "?";
  const days = Math.floor((nowMs - t) / 86_400_000);
  if (days < 1) return "< 1 dia";
  if (days < 60) return `${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} meses`;
  const years = (days / 365).toFixed(1);
  return `${years} anos`;
}

type LeadContext = {
  stageName: string;
  tags: string[];
  customFields: Record<string, unknown>;
  createdAt: string | null;
  ageHuman: string;
  totalMessages: number;
  firstMessageAt: string | null;
  recentStageHistory: Array<{ at: string; from: string | null; to: string | null }>;
  hasBeenTreatedBefore: boolean;
};

function buildContextBlock(ctx: LeadContext, nowIso: string, nowLocal: string): string {
  const fields = Object.keys(ctx.customFields ?? {}).length
    ? JSON.stringify(ctx.customFields)
    : "(vazio)";
  const history = ctx.recentStageHistory.length
    ? ctx.recentStageHistory
        .map((h) => `  - ${fmtBR(h.at)}: ${h.from ?? "?"} → ${h.to ?? "?"}`)
        .join("\n")
    : "  (sem histórico)";
  return `Contexto temporal:
- Agora (${BR_TZ}): ${nowLocal} (ISO ${nowIso})
- Fuso para resolver datas relativas: ${BR_TZ} (offset -03:00)

Contexto do lead:
- Stage atual: ${ctx.stageName}
- Tags atuais: ${ctx.tags.length ? ctx.tags.join(", ") : "nenhuma"}
- custom_fields atuais: ${fields}
- Lead criado: ${ctx.createdAt ? `${fmtBR(ctx.createdAt)} (há ${ctx.ageHuman})` : "?"}
- Total de mensagens no histórico: ${ctx.totalMessages}${ctx.firstMessageAt ? ` (primeira em ${fmtBR(ctx.firstMessageAt)})` : ""}
- Já passou por tratamento/alta antes? ${ctx.hasBeenTreatedBefore ? "SIM" : "não detectado"}
- Últimos stage moves:
${history}`;
}

function buildSystemPrompt(contextBlock: string): string {
  return `Você é um classificador determinístico de um pipeline de CRM médico.
Sua tarefa: ler o histórico de mensagens de um lead e devolver UMA classificação JSON.

Pipeline canônico v4.2 (use exatamente estes nomes em stage_suggestion):
${CANON_NAMES.map((n) => `- ${n}`).join("\n")}

Diretrizes:
- "Novo": primeira interação, sem qualificação humana.
- "Qualificação": secretária/atendente humano já interagiu, descobrindo demanda.
- "Consulta agendada"/"Tratamento agendado": agendamento confirmado.
- "Consulta finalizada"/"Em tratamento": atendimento já realizado.
- "Sem resposta": lead parou de responder.
- "Nutrição inativa": sem retorno há muito tempo.
- "Paciente antigo": ciclo de tratamento já encerrado.
- "B2B / Stakeholders": contato comercial/parceria, NÃO paciente.

Regras:
- confidence reflete sua certeza. Use ≤ 0.5 quando o histórico for ambíguo ou muito curto.
- is_b2b=true SOMENTE se o lead claramente representa empresa/parceiro/fornecedor.
- tags_suggested: tags que DEVEM estar no lead (whitelist v4.2 + descritivas curtas, snake_case ou Title curto).
- tags_remove: tags ATUALMENTE no lead que NÃO refletem mais a realidade e devem ser removidas
  (ex.: "Interessado" num lead que já desistiu; "Comprovante" num pagamento já confirmado). NUNCA remova: risco_clinico, b2b, vip, paciente_antigo, precisa_atencao_humana, Lock manual.
- custom_fields_patch: só inclua chaves se há evidência clara no texto. Use null para apagar campo desatualizado.
- reasons: 1-5 frases curtas em PT-BR justificando a classificação + mudanças aplicadas.

REGRAS ESPECÍFICAS DE TAG "1ª consulta":
- Esta tag identifica PRIMEIRA consulta de um paciente NOVO.
- NUNCA sugira "1ª consulta" se: o lead tem mais de 90 dias de idade, OU já passou por "Em tratamento"/"Consulta finalizada"/"Paciente antigo" em algum momento, OU tem tag "paciente_antigo".
- Se essa tag já está no lead E qualquer condição acima é verdadeira, OBRIGATORIAMENTE inclua "1ª consulta" em tags_remove. Para retorno de paciente antigo, prefira "retorno".

REGRAS PARA DATAS (consulta_agendada_em, procedimento_agendado_em):
- Só preencha quando o lead CONFIRMOU dia E hora explicitamente.
- Para datas relativas ("amanhã", "5a"/"quinta", "semana que vem"), resolva A PARTIR do timestamp da mensagem que cita a data — NÃO a partir de "agora". Os timestamps no histórico já estão em ${BR_TZ}.
- Sempre devolva no formato ISO completo com offset: "YYYY-MM-DDTHH:mm:00-03:00".
- Em remarcação, sobrescreva o valor antigo (o patch substitui).
- Se houver QUALQUER ambiguidade sobre dia ou horário, NÃO preencha o campo (deixe a humana resolver).

Campo intent (escolha UM):
- "agendamento": lead pedindo para marcar consulta/tratamento.
- "reagendamento": lead pedindo para remarcar.
- "duvida_geral": pergunta sobre serviço, valores, planos.
- "nf_reembolso": lead pedindo nota fiscal, recibo, ou docs p/ reembolso.
- "pagamento_alegado": lead afirma ter pago/enviou comprovante (sem confirmação oficial).
- "desistencia": lead diz que não quer mais.
- "interesse_tratamento": lead demonstra interesse em começar tratamento.
- "judicializacao": lead/familiar menciona processo judicial, advogado, ação, Procon, ou ameaça legal.
- "renovacao_receita": lead pedindo renovação de receita/prescrição (paciente já tratado).
- "objecao": lead levantou objeção clara (preço, distância, medo, descrença) que pode ser respondida.
- "outro": nenhum acima se encaixa.

${contextBlock}`;
}

function formatMessages(msgs: Array<{ from_me: boolean; content: string | null; created_at: string }>): string {
  return msgs
    .map((m) => `[${fmtBR(m.created_at)}] ${m.from_me ? "ATENDENTE" : "LEAD"}: ${(m.content ?? "").slice(0, 600)}`)
    .join("\n");
}

const DATE_FIELD_KEYS = new Set(["consulta_agendada_em", "procedimento_agendado_em"]);

type DateReject = { key: string; raw_value: unknown; reason: string };

function sanitizeDateField(
  value: unknown,
  anchorMs: number,
): { ok: true; value: string } | { ok: false; reason: string } {
  if (typeof value !== "string" || !value.trim()) return { ok: false, reason: "not_string" };
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return { ok: false, reason: "unparseable" };
  // Allow up to 2h before the anchor (clock skew / "hoje 10:30" depois das 10:30)
  if (t < anchorMs - 2 * 3_600_000) return { ok: false, reason: "in_past" };
  // Reject more than 90 days after the latest message
  if (t > anchorMs + 90 * 86_400_000) return { ok: false, reason: "too_far_future" };
  return { ok: true, value };
}

async function classifyOne(client: SupabaseClient, leadId: string) {
  const { data: lead } = await client
    .from("leads")
    .select(
      "id, clinic_id, pipeline_id, stage_id, custom_fields, tags, last_processed_message_id_classifier, created_at",
    )
    .eq("id", leadId)
    .single();
  if (!lead) return { skipped: "lead_not_found" };
  if (!lead.pipeline_id) return { skipped: "no_pipeline" };
  if (!(await isClinicPipelineAllowed(client, lead.clinic_id as string))) {
    return { skipped: "clinic_not_allowlisted" };
  }

  // Fetch up to MAX_MSGS most recent messages
  const { data: msgs } = await client
    .from("messages")
    .select("id, from_me, content, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(MAX_MSGS);
  const orderedMsgs = (msgs ?? []).reverse();
  if (orderedMsgs.length === 0) return { skipped: "no_messages" };

  // Current stage
  const { data: stage } = await client
    .from("pipeline_stages")
    .select("name")
    .eq("id", lead.stage_id ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  // Extra context: total message count, first message, recent stage history (join names)
  const [{ count: totalMessagesCount }, { data: firstMsg }, { data: stageHistRaw }] = await Promise.all([
    client.from("messages").select("id", { count: "exact", head: true }).eq("lead_id", leadId),
    client.from("messages").select("created_at").eq("lead_id", leadId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    client
      .from("lead_stage_history")
      .select("moved_at, from_stage_id, to_stage_id")
      .eq("lead_id", leadId)
      .order("moved_at", { ascending: false })
      .limit(8),
  ]);

  // Resolve stage names for history
  const stageIds = new Set<string>();
  for (const h of stageHistRaw ?? []) {
    if (h.from_stage_id) stageIds.add(h.from_stage_id as string);
    if (h.to_stage_id) stageIds.add(h.to_stage_id as string);
  }
  const stageNameMap = new Map<string, string>();
  if (stageIds.size > 0) {
    const { data: stageRows } = await client
      .from("pipeline_stages")
      .select("id, name")
      .in("id", Array.from(stageIds));
    for (const s of stageRows ?? []) stageNameMap.set(s.id as string, s.name as string);
  }
  const TREATED_STAGES = new Set(["Em tratamento", "Consulta finalizada", "Paciente antigo"]);
  const recentStageHistory = (stageHistRaw ?? []).map((h: { moved_at: string; from_stage_id: string | null; to_stage_id: string | null }) => ({
    at: h.moved_at,
    from: h.from_stage_id ? (stageNameMap.get(h.from_stage_id) ?? null) : null,
    to: h.to_stage_id ? (stageNameMap.get(h.to_stage_id) ?? null) : null,
  }));
  const hasBeenTreatedBefore =
    recentStageHistory.some((h) => (h.to && TREATED_STAGES.has(h.to)) || (h.from && TREATED_STAGES.has(h.from))) ||
    ((lead.tags ?? []) as string[]).includes("paciente_antigo");


  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const nowLocal = fmtBR(nowIso);
  const ctx: LeadContext = {
    stageName: stage?.name ?? "?",
    tags: ((lead.tags ?? []) as string[]).map(String),
    customFields: (lead.custom_fields ?? {}) as Record<string, unknown>,
    createdAt: (lead as { created_at?: string }).created_at ?? null,
    ageHuman: (lead as { created_at?: string }).created_at ? ageHuman((lead as { created_at: string }).created_at, nowMs) : "?",
    totalMessages: totalMessagesCount ?? orderedMsgs.length,
    firstMessageAt: firstMsg?.created_at ?? null,
    recentStageHistory,
    hasBeenTreatedBefore,
  };
  const contextBlock = buildContextBlock(ctx, nowIso, nowLocal);

  const ai = await getClinicOpenAI(client, lead.clinic_id);
  if (!ai) return { skipped: "no_clinic_openai_key" };


  // Optional A3 tool: get_lead_history
  const historyToolEnabled = await isEnabled(client, "automation.classifier.history_tool_enabled");
  const tools = historyToolEnabled
    ? {
        get_lead_history: tool({
          description:
            "Retorna eventos passados e classificações anteriores do mesmo lead (último ano, máx 30 itens). Use quando o snippet recente não for suficiente para classificar com confiança.",
          inputSchema: z.object({ lead_id: z.string().uuid() }),
          execute: async ({ lead_id }: { lead_id: string }) => {
            if (lead_id !== leadId) return { error: "lead_id_mismatch" };
            const { data: events } = await client
              .from("lead_events")
              .select("type, payload, created_at")
              .eq("lead_id", leadId)
              .order("created_at", { ascending: false })
              .limit(30);
            return { events: events ?? [] };
          },
        }),
      }
    : undefined;

  const { output } = await generateText({
    model: ai.model(MODEL),
    system: buildSystemPrompt(contextBlock),
    prompt: `Histórico recente do lead (id=${leadId}):\n\n${formatMessages(orderedMsgs)}\n\nClassifique agora.`,
    output: Output.object({ schema: ClassificationSchema }),
    tools,
    stopWhen: stepCountIs(50),
  });

  const cls = output as Classification;

  // ---- Tag reconciliation (add suggested, remove stale, preserve protected) ----
  const tagReplaceEnabled = await isEnabled(client, "automation.classifier.tag_replace.enabled");
  const currentTags: string[] = ((lead.tags ?? []) as string[]).map((t) => String(t));
  const suggested = (cls.tags_suggested ?? []).map((t) => String(t).trim()).filter(Boolean);
  const toRemoveRaw = tagReplaceEnabled
    ? (cls.tags_remove ?? []).map((t) => String(t).trim()).filter(Boolean)
    : [];
  const toRemove = toRemoveRaw.filter((t) => !PROTECTED_TAGS.has(t));
  const removeSet = new Set(toRemove);
  const lowConf = cls.confidence < 0.6;
  const nextTags = Array.from(
    new Set([
      ...currentTags.filter((t) => !removeSet.has(t)),
      ...suggested,
      ...(lowConf ? ["precisa_atencao_humana"] : []),
    ]),
  );
  const tagsChanged =
    nextTags.length !== currentTags.length ||
    nextTags.some((t) => !currentTags.includes(t)) ||
    currentTags.some((t) => !nextTags.includes(t));
  const tagsAdded = nextTags.filter((t) => !currentTags.includes(t));
  const tagsRemoved = currentTags.filter((t) => !nextTags.includes(t));
  if (tagsChanged) {
    await client.from("leads").update({ tags: nextTags }).eq("id", leadId);
  }

  // ---- custom_fields patch (shallow merge; null deletes) ----
  let fieldsChanged = false;
  const fieldsApplied: Record<string, unknown> = {};
  const fieldsRejected: DateReject[] = [];
  // Anchor for date validation = timestamp of the latest message in context
  const anchorMs = Date.parse(orderedMsgs[orderedMsgs.length - 1].created_at) || nowMs;
  if (cls.custom_fields_patch && typeof cls.custom_fields_patch === "object") {
    const patch = cls.custom_fields_patch as Record<string, unknown>;
    const keys = Object.keys(patch);
    if (keys.length > 0) {
      const currentFields = (lead.custom_fields ?? {}) as Record<string, unknown>;
      const nextFields: Record<string, unknown> = { ...currentFields };
      for (const k of keys) {
        let v = patch[k];
        // Sanitize date fields (null is always allowed = explicit delete)
        if (DATE_FIELD_KEYS.has(k) && v !== null) {
          const check = sanitizeDateField(v, anchorMs);
          if (!check.ok) {
            fieldsRejected.push({ key: k, raw_value: v, reason: check.reason });
            continue;
          }
          v = check.value;
        }
        if (v === null) {
          if (k in nextFields) { delete nextFields[k]; fieldsChanged = true; fieldsApplied[k] = null; }
        } else if (currentFields[k] !== v) {
          nextFields[k] = v; fieldsChanged = true; fieldsApplied[k] = v;
        }
      }
      if (fieldsChanged) {
        await client.from("leads").update({ custom_fields: nextFields }).eq("id", leadId);
      }
    }
  }


  // ---- Stage move (B2B path or generic classifier-stage path) ----
  const lastMsgIdNow = orderedMsgs[orderedMsgs.length - 1].id;
  let stageMove: Record<string, unknown> = { applied: false, reason: "no_change" };

  const b2bEnabled = await isEnabled(client, "automation.b2b_move.enabled");
  const genericMoveEnabled = await isEnabled(client, "automation.classifier.stage_move.enabled");
  const minConfMove = await getSettingNumber(client, "automation.classifier.stage_move_min_confidence", 0.75);

  if (cls.is_b2b && b2bEnabled && cls.confidence >= 0.9) {
    const b2bId = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, "B2B / Stakeholders");
    if (b2bId && lead.stage_id !== b2bId) {
      const res = await pipelineMove(client, {
        leadId,
        toStageId: b2bId,
        source: "auto:classifier-b2b",
        reason: `Classifier B2B (conf=${cls.confidence.toFixed(2)})`,
        ruleKey: "automation.b2b_move.enabled",
        idempotencyKey: `b2b:${leadId}:${lastMsgIdNow}`,
      });
      stageMove = { applied: res.moved, from: lead.stage_id, to: b2bId, path: "b2b", reason: res.moved ? "ok" : (res as { reason: string }).reason };
    } else {
      stageMove = { applied: false, reason: b2bId ? "already_at_destination" : "stage_alias_not_found", path: "b2b" };
    }
  } else if (genericMoveEnabled && cls.confidence >= minConfMove && !lowConf) {
    const targetId = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, cls.stage_suggestion);
    if (!targetId) {
      stageMove = { applied: false, reason: `stage_alias_not_found:${cls.stage_suggestion}`, path: "generic" };
    } else if (targetId === lead.stage_id) {
      stageMove = { applied: false, reason: "same_stage", path: "generic", to: targetId };
    } else {
      const res = await pipelineMove(client, {
        leadId,
        toStageId: targetId,
        source: "auto:classifier-stage",
        reason: `Classifier → ${cls.stage_suggestion} (conf=${cls.confidence.toFixed(2)})`,
        ruleKey: "automation.classifier.stage_move.enabled",
        idempotencyKey: `classify-stage:${leadId}:${lastMsgIdNow}`,
      });
      stageMove = { applied: res.moved, from: lead.stage_id, to: targetId, path: "generic", suggestion: cls.stage_suggestion, reason: res.moved ? "ok" : (res as { reason: string }).reason };
    }
  } else {
    stageMove = {
      applied: false,
      path: "generic",
      reason: !genericMoveEnabled ? "toggle_off" : (lowConf ? "low_confidence" : `below_threshold(${minConfMove})`),
      suggestion: cls.stage_suggestion,
      confidence: cls.confidence,
    };
  }

  // Persist classifier event WITH telemetry of what was applied.
  await client.from("lead_events").insert({
    clinic_id: lead.clinic_id,
    lead_id: leadId,
    type: "auto:classifier",
    payload: {
      ...(cls as unknown as Record<string, unknown>),
      applied: {
        stage_move: stageMove,
        tags_diff: { added: tagsAdded, removed: tagsRemoved, requested_remove: toRemoveRaw },
        custom_fields: fieldsApplied,
        custom_fields_rejected: fieldsRejected,
      },
    },
  });



  // Marco 3 — task triggers a partir do intent.
  let nfTaskResult: unknown = null;
  let paymentAllegedResult: unknown = null;
  if (cls.intent === "nf_reembolso") {
    nfTaskResult = await runNfTask(client, {
      leadId,
      clinicId: lead.clinic_id,
      stageName: stage?.name ?? null,
    });
  }

  // Marco 4 — judicialização, renovação receita, sugestão objeção.
  let judResult: unknown = null;
  let renovResult: unknown = null;
  let objResult: unknown = null;
  if (cls.intent === "judicializacao") {
    judResult = await runJudicializacao(client, {
      leadId,
      clinicId: lead.clinic_id,
      reasons: cls.reasons,
    });
  }
  if (cls.intent === "renovacao_receita") {
    renovResult = await runRenovacaoReceita(client, {
      leadId,
      clinicId: lead.clinic_id,
      stageName: stage?.name ?? null,
    });
  }
  if (cls.intent === "objecao") {
    objResult = await runObjectionSuggest(client, {
      leadId,
      clinicId: lead.clinic_id,
      reasons: cls.reasons,
    });
  }
  if (cls.intent === "pagamento_alegado") {
    paymentAllegedResult = await runPaymentAlleged(client, {
      leadId,
      clinicId: lead.clinic_id,
    });
  }

  // Marco 3 — summarizer (força se intent não trivial).
  const summarizeForce = cls.intent !== "outro";
  const summarizeResult = await runSummarize(client, leadId, {
    force: summarizeForce,
    reason: summarizeForce ? `intent:${cls.intent}` : "post_classify",
  }).catch((err) => ({ status: "error" as const, reason: err instanceof Error ? err.message : String(err) }));

  // Update watermark + clear flag
  const lastMsgId = orderedMsgs[orderedMsgs.length - 1].id;
  await client
    .from("leads")
    .update({
      last_processed_message_id_classifier: lastMsgId,
      needs_ai_review: false,
      last_classified_at: new Date().toISOString(),
      ai_review_reasons: (
        await client.from("leads").select("ai_review_reasons").eq("id", leadId).single()
      ).data?.ai_review_reasons?.filter((r: string) => r !== "pipeline-classifier") ?? [],
    })
    .eq("id", leadId);

  return {
    classification: cls,
    last_message_id: lastMsgId,
    summarize: summarizeResult,
    nf_task: nfTaskResult,
    payment_alleged: paymentAllegedResult,
    judicializacao: judResult,
    renovacao_receita: renovResult,
    objection_suggest: objResult,
  };
}

async function tickQueue(client: SupabaseClient) {
  if (!(await isEnabled(client, "automation.classifier.enabled"))) {
    return { skipped: "toggle_off" };
  }
  const { data: leads } = await client
    .from("leads")
    .select("id")
    .eq("needs_ai_review", true)
    .lte("ai_review_queued_at", new Date().toISOString())
    .contains("ai_review_reasons", ["pipeline-classifier"])
    .limit(BATCH_LIMIT);

  const results: Array<Record<string, unknown>> = [];
  for (const l of leads ?? []) {
    try {
      const r = await classifyOne(client, l.id);
      results.push({ lead_id: l.id, ok: true, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("classify failed", l.id, msg);
      results.push({ lead_id: l.id, ok: false, error: msg });
      // Don't leave the lead in a re-poll loop forever — push queue 10 min ahead
      await client
        .from("leads")
        .update({ ai_review_queued_at: new Date(Date.now() + 10 * 60_000).toISOString() })
        .eq("id", l.id);
    }
  }
  return { processed: results.length, results };
}

// V1 fallback — preserved intact behind feature flag automation.classifier.version.
// The HTTP listener lives in ./index.ts; this file exports the handler.
export async function handleV1(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    let result: unknown;
    if (body.action === "tick") {
      result = await tickQueue(client);
    } else if (body.action === "lead") {
      if (!body.lead_id) throw new Error("lead_id required");
      result = await classifyOne(client, body.lead_id);
    } else {
      return new Response(JSON.stringify({ error: "unknown_action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(JSON.stringify({ v: "v1", action: body.action, result }));
    return new Response(JSON.stringify({ ok: true, version: "v1", result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("pipeline-classify v1 error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

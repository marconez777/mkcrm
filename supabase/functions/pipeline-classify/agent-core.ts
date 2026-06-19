// supabase/functions/pipeline-classify/agent-core.ts
// V3 — pipeline de 3 agentes sequenciais:
//   1) Resumidor   (gpt-4o, fallback gpt-5-mini) → {summary, mentioned_dates}
//   2) Tipificador (gpt-5-mini)                  → {tags_suggested, custom_fields_patch}
//   3) Maestro     (gpt-5-mini)                  → {stage_suggestion, intent, is_b2b, confidence, reasons, mentioned_intents}
//
// Datas NUNCA são convertidas pelo LLM. O Agente 1 é o único que vê o histórico
// completo (formatMessages) e por isso é o único que pode emitir anchor_iso real.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { generateText, Output } from "npm:ai@^6";
import { getClinicOpenAI } from "../_shared/clinic-openai.ts";
import { logUsage } from "../_shared/metrics.ts";
import { buildContextBlock, formatMessages, type LeadContext } from "./context.ts";
import {
  CANON_NAMES,
  INTENT_VALUES,
  MaestroOutputSchema,
  SummarizerOutputSchema,
  TypifierOutputSchema,
  mergeV3Outputs,
  type ClassificationV2,
  type MaestroOutput,
  type SummarizerOutput,
  type TypifierOutput,
} from "./schema.ts";

type AiUsageShape = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
};

function extractTokens(usage: unknown): {
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
} {
  const u = (usage ?? {}) as AiUsageShape;
  const input = u.inputTokens ?? u.promptTokens ?? null;
  const output = u.outputTokens ?? u.completionTokens ?? null;
  const total =
    u.totalTokens ?? ((input ?? 0) + (output ?? 0) || null);
  return { input_tokens: input, output_tokens: output, total_tokens: total };
}

async function recordStep(opts: {
  ctx: LeadContext;
  model: string;
  operation: string;
  status: "success" | "error";
  latencyMs: number;
  usage?: unknown;
  error?: string | null;
}) {
  const tokens = extractTokens(opts.usage);
  await logUsage({
    clinic_id: opts.ctx.lead.clinic_id,
    lead_id: opts.ctx.lead.id,
    model: opts.model,
    operation: opts.operation as "chat",
    status: opts.status,
    input_tokens: tokens.input_tokens,
    output_tokens: tokens.output_tokens,
    total_tokens: tokens.total_tokens,
    latency_ms: Math.round(opts.latencyMs),
    error: opts.error ?? null,
  });
}


const SUMMARIZER_MODEL_PRIMARY = "gpt-4o";
const SUMMARIZER_MODEL_FALLBACK = "gpt-5-mini";
const TYPIFIER_MODEL = "gpt-5-mini";
const MAESTRO_MODEL = "gpt-5";

export const AGENT_MODEL = MAESTRO_MODEL; // retro-compat (apply.ts lia esse símbolo)

// ===== Agente 1: Resumidor =====

function buildSummarizerSystem(): string {
  return `Você é um extrator clínico para CRM médico.
Tarefa: ler o histórico recente deste paciente e produzir um resumo factual
de 3 a 4 linhas em PT-BR. Separe claramente PASSADO (tratamentos, pagamentos,
consultas já realizadas) de PRESENTE (o que o lead quer, recusou ou pediu na
ÚLTIMA mensagem). Não invente nada que não esteja no histórico.

IMPORTANTÍSSIMO NO RESUMO:
- Se o paciente mencionar a MODALIDADE de atendimento (ex: "presencial", "online", "teleconsulta"), você DEVE citar isso no resumo.
- Se o paciente mencionar QUALQUER campo personalizado ou dado cadastral importante, inclua no resumo.

Além do resumo, devolva "mentioned_dates" contendo as datas citadas pelo paciente ou pela secretária.
NÃO converta datas — devolva a string crua exatamente como aparece ("amanhã às 15h", "quinta-feira", "dia 24/06") e "anchor_iso" = o
timestamp ISO da MENSAGEM que cita a data (já presente entre colchetes no
histórico, no fuso America/Sao_Paulo). "kind": "consulta" para primeiras
consultas/avaliações/retornos; "procedimento" para procedimento/tratamento agendado.

CRÍTICO — REGRA OBRIGATÓRIA SOBRE DATAS:
Se você escrever QUALQUER referência a data/horário de consulta, retorno, avaliação, procedimento ou tratamento no campo "summary" (ex: "19/06 às 10:00", "amanhã", "quinta-feira", "dia 24/06", "semana que vem", "próxima terça"), você é OBRIGADO a replicar essa data no array "mentioned_dates". NUNCA deixe "mentioned_dates" vazio se o summary cita uma data. Se você não tiver certeza de qual mensagem citou a data, use o "anchor_iso" da última mensagem do histórico que fala sobre essa data.

"raw" deve ser a string crua exatamente como aparece na conversa (NÃO converta nem normalize). "anchor_iso" é o timestamp ISO em colchetes da mensagem que citou a data. "kind": "consulta" para 1ª consulta/avaliação/retorno; "procedimento" para procedimento/tratamento agendado.

Exemplos few-shot (siga este padrão à risca):

EX1 — paciente confirma horário proposto pela secretária:
Histórico:
[2026-06-18T10:00:00-03:00] Secretária: Posso agendar para 19/06 às 10h com Dr. Ivan?
[2026-06-18T10:05:00-03:00] Paciente: Pode sim, confirmado!
Summary correto: "PRESENTE: Paciente confirmou consulta presencial com Dr. Ivan em 19/06 às 10:00."
mentioned_dates correto: [{ "raw": "19/06 às 10h", "anchor_iso": "2026-06-18T10:00:00-03:00", "kind": "consulta" }]

EX2 — paciente pede reagendamento:
Histórico:
[2026-06-18T14:00:00-03:00] Paciente: Preciso remarcar, pode ser quinta-feira à tarde?
Summary correto: "PRESENTE: Lead solicitou reagendamento para quinta-feira à tarde."
mentioned_dates correto: [{ "raw": "quinta-feira à tarde", "anchor_iso": "2026-06-18T14:00:00-03:00", "kind": "consulta" }]

EX3 — duas datas (consulta + procedimento):
[2026-06-18T11:00:00-03:00] Secretária: Avaliação dia 20/06 e procedimento dia 27/06.
mentioned_dates correto: [
  { "raw": "dia 20/06", "anchor_iso": "2026-06-18T11:00:00-03:00", "kind": "consulta" },
  { "raw": "dia 27/06", "anchor_iso": "2026-06-18T11:00:00-03:00", "kind": "procedimento" }
]

EX4 — nenhuma data no histórico:
mentioned_dates correto: []

IMPORTANTE: responda APENAS com um objeto JSON válido seguindo o schema.`;
}

async function runSummarizer(
  ai: NonNullable<Awaited<ReturnType<typeof getClinicOpenAI>>>,
  ctx: LeadContext,
): Promise<{ output: SummarizerOutput; model: string; usage?: unknown }> {
  const prompt = `${buildContextBlock(ctx)}

Histórico de mensagens (lead id=${ctx.lead.id}):

${formatMessages(ctx.messages)}

Produza o resumo agora.`;

  const tryModel = async (modelId: string) => {
    const result = await generateText({
      model: ai.model(modelId),
      system: buildSummarizerSystem(),
      prompt,
      output: Output.object({ schema: SummarizerOutputSchema }),
    });
    return result;
  };

  try {
    const result = await tryModel(SUMMARIZER_MODEL_PRIMARY);
    return {
      output: result.output as SummarizerOutput,
      model: SUMMARIZER_MODEL_PRIMARY,
      usage: (result as { usage?: unknown }).usage,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[summarizer] primary failed", SUMMARIZER_MODEL_PRIMARY, msg);
    // Fallback em casos comuns: modelo indisponível, ou o modelo gerou JSON inválido.
    if (
      !/404|not.?found|does not have access|model_not_found|unsupported|no object generated|response did not match|invalid.*json|could not parse/i.test(
        msg,
      )
    ) {
      throw err;
    }
    try {
      const result = await tryModel(SUMMARIZER_MODEL_FALLBACK);
      return {
        output: result.output as SummarizerOutput,
        model: `${SUMMARIZER_MODEL_FALLBACK} (fallback from ${SUMMARIZER_MODEL_PRIMARY})`,
        usage: (result as { usage?: unknown }).usage,
      };
    } catch (err2) {
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      console.error("[summarizer] fallback failed", SUMMARIZER_MODEL_FALLBACK, msg2);
      throw err2;
    }
  }
}

// ===== Agente 2: Tipificador =====

function buildTypifierSystem(): string {
  return `Você é o tipificador do CRM médico. Recebe um RESUMO já produzido por
outro agente — NÃO leia histórico cru, não invente contexto, baseie-se SOMENTE
no resumo + nos campos atuais do lead.

Tarefa:
- "tags_suggested": liste TODAS as tags que devem estar no lead após a
  classificação (snake_case ou Título curto, máx 8). O sistema computa o que
  adicionar e o que remover.
- "custom_fields_patch": objeto com chaves de campos personalizados a atualizar.
  Use só chaves estritamente justificadas pelo resumo. NÃO escreva datas aqui —
  o pipeline determinístico cuida disso.

Se nada justificar uma tag ou campo, devolva arrays/objetos vazios.

IMPORTANTE: responda APENAS com um objeto JSON válido seguindo o schema.`;
}

async function runTypifier(
  ai: NonNullable<Awaited<ReturnType<typeof getClinicOpenAI>>>,
  ctx: LeadContext,
  summary: string,
): Promise<{ output: TypifierOutput; usage?: unknown }> {
  const result = await generateText({
    model: ai.model(TYPIFIER_MODEL),
    system: buildTypifierSystem(),
    prompt: `${buildContextBlock(ctx)}

RESUMO factual do lead (gerado pelo Agente 1):
${summary}

Devolva tags_suggested e custom_fields_patch.`,
    output: Output.object({ schema: TypifierOutputSchema }),
  });
  return {
    output: result.output as TypifierOutput,
    usage: (result as { usage?: unknown }).usage,
  };
}

// ===== Agente 3: Maestro =====

function buildMaestroSystem(): string {
  return `Você é o maestro do classificador. Define stage e intent baseando-se
SOMENTE no resumo factual e nos sinais determinísticos.
Não invente contexto.

Pipeline canônico (use EXATAMENTE estes nomes em stage_suggestion):
${CANON_NAMES.map((n) => `- ${n}`).join("\n")}

Diretrizes de stage:
- "Novo": primeira interação, sem qualificação humana.
- "Qualificação": atendente ainda está em descoberta ativa de demanda; o lead
  ainda NÃO recebeu proposta/preço, OU recebeu e está em diálogo ativo (sem
  objeção fechada e sem silêncio prolongado).
- "Consulta agendada"/"Tratamento agendado": agendamento confirmado (dia+hora).
- "Consulta finalizada"/"Em tratamento": atendimento já realizado.
- "Sem resposta": lead parou de responder em fases iniciais sem demonstrar
  interesse claro em tratamento.
- "Nutrição inativa": (a) lead sem retorno há muito tempo, OU (b) lead com
  interesse claro no tratamento/consulta mas que NÃO fechou agendamento
  (objeção de preço, pediu desconto que não foi aceito, "vou pensar", disse
  estar sem cartão/dinheiro no momento, parou de responder depois que a
  secretaria/atendente IA informou o preço, etc.).
- "Paciente antigo": ciclo de tratamento já encerrado.
- "B2B / Stakeholders": contato comercial/parceria, NÃO paciente.

REGRAS ESTRITAS:
1) Se o paciente JÁ foi tratado/atendido antes (flag treated_before=true ou
   tag "paciente_antigo" presente) E está marcando uma próxima consulta de
   acompanhamento/ciclo → intent="agendamento_retorno", stage="Consulta agendada".
2) Stage "Paciente antigo" SÓ pode ser usado quando:
   (a) houve alta clínica explícita, OU
   (b) o ciclo de tratamento foi encerrado, OU
   (c) o lead está inativo há MAIS de 6 meses e está retomando contato agora.
   Em qualquer outro caso, NÃO use "Paciente antigo".
3) is_b2b=true SOMENTE se o resumo claramente caracteriza empresa/parceiro/fornecedor.
4) **Interesse-sem-fechamento → Nutrição inativa.** Se o resumo indicar que o
   lead tem interesse no tratamento/consulta MAS o agendamento NÃO foi
   confirmado (objeção de preço, pediu desconto recusado, "vou pensar", sem
   cartão/dinheiro no momento, **parou de responder depois que a secretaria
   ou atendente IA informou o preço por mais de 4 horas** — use o sinal
   determinístico \`hours_since_last_message > 4\` combinado com
   \`last_message_from_attendant=true\` para detectar esse silêncio —, etc.),
   use stage="Nutrição inativa" e intent="objecao" (ou "desistencia" se ele
   desistiu explicitamente). **NÃO deixe em "Qualificação" só por inércia.**
   Essa decisão exige confidence ≥ 0.8 para que o sistema de fato mova o lead.

Intents disponíveis (escolha UM em "intent"):
${INTENT_VALUES.map((i) => `- ${i}`).join("\n")}

"confidence" reflete sua certeza: 0.0-0.5 ambíguo, 0.5-0.75 razoável,
0.75-0.9 alto, 0.9-1 inequívoco.
"reasons": 1-5 frases curtas em PT-BR justificando a decisão.

IMPORTANTE: responda APENAS com um objeto JSON válido seguindo o schema.`;
}

async function runMaestro(
  ai: NonNullable<Awaited<ReturnType<typeof getClinicOpenAI>>>,
  ctx: LeadContext,
  summary: string,
): Promise<{ output: MaestroOutput; usage?: unknown }> {
  const lastMsg = ctx.messages[ctx.messages.length - 1];
  const lastMsgMs = lastMsg ? Date.parse(lastMsg.created_at) : null;
  const monthsInactive =
    ctx.lead.created_at && lastMsgMs
      ? Math.floor((ctx.nowMs - lastMsgMs) / (30 * 86_400_000))
      : null;
  const hoursSinceLastMessage = lastMsgMs
    ? Math.round(((ctx.nowMs - lastMsgMs) / 3_600_000) * 10) / 10
    : null;
  const lastMessageFromAttendant = lastMsg ? lastMsg.from_me === true : null;

  const signals = {
    current_stage: ctx.stageName,
    current_tags: ctx.lead.tags,
    treated_before: ctx.hasBeenTreatedBefore,
    has_paciente_antigo_tag: ctx.lead.tags.includes("paciente_antigo"),
    months_since_last_message: monthsInactive,
    hours_since_last_message: hoursSinceLastMessage,
    last_message_from_attendant: lastMessageFromAttendant,
    recent_stage_history: ctx.recentStageHistory,
  };

  const result = await generateText({
    model: ai.model(MAESTRO_MODEL),
    system: buildMaestroSystem(),
    prompt: `Sinais determinísticos do lead (não-LLM):
${JSON.stringify(signals, null, 2)}

RESUMO factual (Agente 1):
${summary}

Devolva stage_suggestion, intent, mentioned_intents, is_b2b, confidence, reasons.`,
    output: Output.object({ schema: MaestroOutputSchema }),
  });
  return {
    output: result.output as MaestroOutput,
    usage: (result as { usage?: unknown }).usage,
  };
}

// ===== Orquestração =====

export type AgentMode = "full" | "summarizer" | "typifier" | "maestro";

export type RunAgentSuccess = {
  classification: ClassificationV2;
  usage?: unknown;
  mode: AgentMode;
  agents?: {
    summarizer_model: string;
    typifier_model: string;
    maestro_model: string;
    summary_chars: number;
    summary: string;
    latency_ms: { summarizer: number; typifier: number; maestro: number };
    ran: { summarizer: boolean; typifier: boolean; maestro: boolean };
  };
};

export async function runAgent(
  client: SupabaseClient,
  ctx: LeadContext,
  opts: { historyToolEnabled: boolean; onlyAgent?: AgentMode },
): Promise<RunAgentSuccess | { error: string }> {
  const ai = await getClinicOpenAI(client, ctx.lead.clinic_id);
  if (!ai) return { error: "no_clinic_openai_key" };

  const mode: AgentMode = opts.onlyAgent ?? "full";
  const runSummarizerStep = mode === "full" || mode === "summarizer";
  const runTypifierStep = mode === "full" || mode === "typifier";
  const runMaestroStep = mode === "full" || mode === "maestro";

  // ----- Passo 1 — Resumidor -----
  let summary: string;
  let summarizerModel = SUMMARIZER_MODEL_PRIMARY;
  let mentionedDates: SummarizerOutput["mentioned_dates"] = [];
  let usage1: unknown;
  let lat1 = 0;
  const t1 = performance.now();
  if (runSummarizerStep) {
    try {
      const r1 = await runSummarizer(ai, ctx);
      summary = r1.output.summary;
      mentionedDates = r1.output.mentioned_dates ?? [];
      summarizerModel = r1.model;
      usage1 = r1.usage;
      await recordStep({
        ctx,
        model: summarizerModel.split(" ")[0],
        operation: "classifier:summarizer",
        status: "success",
        latencyMs: performance.now() - t1,
        usage: usage1,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await recordStep({
        ctx,
        model: SUMMARIZER_MODEL_PRIMARY,
        operation: "classifier:summarizer",
        status: "error",
        latencyMs: performance.now() - t1,
        error: msg.slice(0, 500),
      });
      return { error: `agent_step1_failed: ${msg.slice(0, 200)}` };
    }
    lat1 = performance.now() - t1;
  } else {
    summary = (ctx.lead.ai_summary ?? "").trim();
    if (!summary) {
      return { error: `agent_step1_failed: missing_ai_summary_for_partial_mode_${mode}` };
    }
    summarizerModel = "(reused ai_summary)";
  }

  // ----- Passo 2 e 3 — Paralelizados para evitar Timeout -----
  let typified: TypifierOutput = { tags_suggested: ctx.lead.tags, custom_fields_patch: {} };
  let usage2: unknown;
  let lat2 = 0;
  let err2Str: string | null = null;

  let maestro: MaestroOutput = {
    stage_suggestion: ctx.stageName,
    intent: "outro",
    mentioned_intents: [],
    is_b2b: false,
    confidence: 0.5,
    reasons: ["partial_mode_skipped_maestro"],
  };
  let usage3: unknown;
  let lat3 = 0;
  let err3Str: string | null = null;

  const promises = [];

  if (runTypifierStep) {
    promises.push(
      (async () => {
        const t2 = performance.now();
        try {
          const r2 = await runTypifier(ai, ctx, summary);
          typified = r2.output;
          usage2 = r2.usage;
          await recordStep({ ctx, model: TYPIFIER_MODEL, operation: "classifier:typifier", status: "success", latencyMs: performance.now() - t2, usage: usage2 });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          err2Str = msg;
          await recordStep({ ctx, model: TYPIFIER_MODEL, operation: "classifier:typifier", status: "error", latencyMs: performance.now() - t2, error: msg.slice(0, 500) });
        }
        lat2 = performance.now() - t2;
      })()
    );
  }

  if (runMaestroStep) {
    promises.push(
      (async () => {
        const t3 = performance.now();
        try {
          // Maestro não precisa mais esperar a tipificação terminar
          const r3 = await runMaestro(ai, ctx, summary);
          maestro = r3.output;
          usage3 = r3.usage;
          await recordStep({ ctx, model: MAESTRO_MODEL, operation: "classifier:maestro", status: "success", latencyMs: performance.now() - t3, usage: usage3 });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          err3Str = msg;
          await recordStep({ ctx, model: MAESTRO_MODEL, operation: "classifier:maestro", status: "error", latencyMs: performance.now() - t3, error: msg.slice(0, 500) });
        }
        lat3 = performance.now() - t3;
      })()
    );
  }

  await Promise.all(promises);

  if (err2Str) return { error: `agent_step2_failed: ${err2Str.slice(0, 200)}` };
  if (err3Str) return { error: `agent_step3_failed: ${err3Str.slice(0, 200)}` };

  const summarizerOut: SummarizerOutput = {
    summary,
    mentioned_dates: mentionedDates,
  };

  return {
    classification: mergeV3Outputs(summarizerOut, typified, maestro),
    usage: { agent1: usage1, agent2: usage2, agent3: usage3 },
    mode,
    agents: {
      summarizer_model: summarizerModel,
      typifier_model: TYPIFIER_MODEL,
      maestro_model: MAESTRO_MODEL,
      summary_chars: summary.length,
      summary,
      latency_ms: {
        summarizer: Math.round(lat1),
        typifier: Math.round(lat2),
        maestro: Math.round(lat3),
      },
      ran: {
        summarizer: runSummarizerStep,
        typifier: runTypifierStep,
        maestro: runMaestroStep,
      },
    },
  };
}


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

const SUMMARIZER_MODEL_PRIMARY = "gpt-4o";
const SUMMARIZER_MODEL_FALLBACK = "gpt-5-mini";
const TYPIFIER_MODEL = "gpt-5-mini";
const MAESTRO_MODEL = "gpt-5-mini";

export const AGENT_MODEL = MAESTRO_MODEL; // retro-compat (apply.ts lia esse símbolo)

// ===== Agente 1: Resumidor =====

function buildSummarizerSystem(): string {
  return `Você é um extrator clínico para CRM médico.
Tarefa: ler o histórico recente deste paciente e produzir um resumo factual
de 3 a 4 linhas em PT-BR. Separe claramente PASSADO (tratamentos, pagamentos,
consultas já realizadas) de PRESENTE (o que o lead quer, recusou ou pediu na
ÚLTIMA mensagem). Não invente nada que não esteja no histórico.

Além do resumo, devolva "mentioned_dates" SOMENTE para agendamentos
confirmados (dia + hora). NÃO converta datas — devolva a string crua exatamente
como aparece ("amanhã às 15h", "quinta-feira", "dia 24/06") e "anchor_iso" = o
timestamp ISO da MENSAGEM que cita a data (já presente entre colchetes no
histórico, no fuso America/Sao_Paulo). "kind": "consulta" para primeiras
consultas/avaliações; "procedimento" para procedimento/tratamento agendado.
Se houver qualquer ambiguidade ou só uma das partes (só dia OU só hora), NÃO
inclua.`;
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
    // Sinais comuns: 404 model not found, model_not_found, does not have access
    if (!/404|not.?found|does not have access|model_not_found|unsupported/i.test(msg)) {
      throw err;
    }
    const result = await tryModel(SUMMARIZER_MODEL_FALLBACK);
    return {
      output: result.output as SummarizerOutput,
      model: `${SUMMARIZER_MODEL_FALLBACK} (fallback from ${SUMMARIZER_MODEL_PRIMARY})`,
      usage: (result as { usage?: unknown }).usage,
    };
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

Se nada justificar uma tag ou campo, devolva arrays/objetos vazios.`;
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
SOMENTE no resumo factual e nas tags já tipificadas. Não invente contexto.

Pipeline canônico (use EXATAMENTE estes nomes em stage_suggestion):
${CANON_NAMES.map((n) => `- ${n}`).join("\n")}

Diretrizes de stage:
- "Novo": primeira interação, sem qualificação humana.
- "Qualificação": atendente humano já interagiu descobrindo demanda.
- "Consulta agendada"/"Tratamento agendado": agendamento confirmado (dia+hora).
- "Consulta finalizada"/"Em tratamento": atendimento já realizado.
- "Sem resposta": lead parou de responder.
- "Nutrição inativa": sem retorno há muito tempo.
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

Intents disponíveis (escolha UM em "intent"):
${INTENT_VALUES.map((i) => `- ${i}`).join("\n")}

"confidence" reflete sua certeza: 0.0-0.5 ambíguo, 0.5-0.75 razoável,
0.75-0.9 alto, 0.9-1 inequívoco.
"reasons": 1-5 frases curtas em PT-BR justificando a decisão.`;
}

async function runMaestro(
  ai: NonNullable<Awaited<ReturnType<typeof getClinicOpenAI>>>,
  ctx: LeadContext,
  summary: string,
  typified: TypifierOutput,
): Promise<{ output: MaestroOutput; usage?: unknown }> {
  const monthsInactive =
    ctx.lead.created_at && ctx.messages.length
      ? Math.floor(
          (ctx.nowMs - Date.parse(ctx.messages[ctx.messages.length - 1].created_at)) /
            (30 * 86_400_000),
        )
      : null;

  const signals = {
    current_stage: ctx.stageName,
    current_tags: ctx.lead.tags,
    treated_before: ctx.hasBeenTreatedBefore,
    has_paciente_antigo_tag: ctx.lead.tags.includes("paciente_antigo"),
    months_since_last_message: monthsInactive,
    recent_stage_history: ctx.recentStageHistory,
  };

  const result = await generateText({
    model: ai.model(MAESTRO_MODEL),
    system: buildMaestroSystem(),
    prompt: `Sinais determinísticos do lead (não-LLM):
${JSON.stringify(signals, null, 2)}

RESUMO factual (Agente 1):
${summary}

TIPIFICAÇÃO (Agente 2):
${JSON.stringify(typified, null, 2)}

Devolva stage_suggestion, intent, mentioned_intents, is_b2b, confidence, reasons.`,
    output: Output.object({ schema: MaestroOutputSchema }),
  });
  return {
    output: result.output as MaestroOutput,
    usage: (result as { usage?: unknown }).usage,
  };
}

// ===== Orquestração =====

export type RunAgentSuccess = {
  classification: ClassificationV2;
  usage?: unknown;
  agents?: {
    summarizer_model: string;
    typifier_model: string;
    maestro_model: string;
    summary_chars: number;
  };
};

export async function runAgent(
  client: SupabaseClient,
  ctx: LeadContext,
  _opts: { historyToolEnabled: boolean }, // compat — ignorado em V3
): Promise<RunAgentSuccess | { error: string }> {
  const ai = await getClinicOpenAI(client, ctx.lead.clinic_id);
  if (!ai) return { error: "no_clinic_openai_key" };

  // Passo 1
  let s1: SummarizerOutput;
  let summarizerModel: string;
  let usage1: unknown;
  try {
    const r1 = await runSummarizer(ai, ctx);
    s1 = r1.output;
    summarizerModel = r1.model;
    usage1 = r1.usage;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `agent_step1_failed: ${msg.slice(0, 200)}` };
  }

  // Passo 2
  let s2: TypifierOutput;
  let usage2: unknown;
  try {
    const r2 = await runTypifier(ai, ctx, s1.summary);
    s2 = r2.output;
    usage2 = r2.usage;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `agent_step2_failed: ${msg.slice(0, 200)}` };
  }

  // Passo 3
  let s3: MaestroOutput;
  let usage3: unknown;
  try {
    const r3 = await runMaestro(ai, ctx, s1.summary, s2);
    s3 = r3.output;
    usage3 = r3.usage;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `agent_step3_failed: ${msg.slice(0, 200)}` };
  }

  return {
    classification: mergeV3Outputs(s1, s2, s3),
    usage: { agent1: usage1, agent2: usage2, agent3: usage3 },
    agents: {
      summarizer_model: summarizerModel,
      typifier_model: TYPIFIER_MODEL,
      maestro_model: MAESTRO_MODEL,
      summary_chars: s1.summary.length,
    },
  };
}

// supabase/functions/pipeline-classify/agent-core.ts
// V6 — pipeline de 5 agentes:
//   1) Resumidor   (gpt-4o, fallback gpt-5-mini) → {summary, mentioned_dates}
//   2) Agendador   (gpt-5-nano)                  → {is_scheduling_action, scheduling_intent, reasons}
//   3) Preenchedor (gpt-5-mini)                  → {tags_suggested, custom_fields_patch}
//   4) Movimentador(gpt-5-nano)                  → {stage_suggestion, intent, mentioned_intents, is_b2b, reasons}

//   5) Maestro     (gpt-5)                       → Validador final

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { generateText, Output } from "npm:ai@^6";
import { getClassifierAi, pickModel, type ClassifierAi } from "../_shared/classifier-ai.ts";
import { logUsage } from "../_shared/metrics.ts";
import { buildContextBlock, formatMessages, type ClinicFieldDef, type LeadContext } from "./context.ts";
import {
  CANON_NAMES,
  INTENT_VALUES,
  AgendadorOutputSchema,
  MaestroOutputSchema,
  MovimentadorOutputSchema,
  SummarizerOutputSchema,
  TypifierOutputSchema,
  mergeV6Outputs,
  type AgendadorOutput,
  type ClassificationV2,
  type MaestroOutput,
  type MovimentadorOutput,
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

/** Defesa em profundidade: NUNCA permite que uma falha de telemetria
 *  derrube o Promise.all que registra os 3 agentes paralelos. Sem isso,
 *  uma exceção em recordStep (token parsing, pricing desconhecido) silencia
 *  agendador e movimentador no `ai_usage` (P25 da auditoria 2026-06-22). */
async function safeRecordStep(opts: Parameters<typeof recordStep>[0]) {
  try {
    await recordStep(opts);
  } catch (e) {
    console.error(
      `[classify] recordStep failed (${opts.operation}):`,
      e instanceof Error ? e.message : String(e),
    );
  }
}


/** Retry on 429 (exponential backoff) and schema-mismatch / transient errors. */
async function withSchemaRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  // P3: backoff exponencial dedicado para rate-limit (429), antes do schema-retry legado.
  const RL_DELAYS_MS = [200, 400, 800, 1600];
  for (let attempt = 0; attempt < RL_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const anyErr = err as {
        status?: number;
        statusCode?: number;
        response?: { status?: number; headers?: Headers };
        cause?: { status?: number };
      };
      const status = anyErr.status ?? anyErr.statusCode ?? anyErr.response?.status ?? anyErr.cause?.status;
      const is429 = status === 429 || /\b429\b|rate.?limit|too many requests/i.test(msg);
      if (!is429) break; // sai do loop e cai no fluxo de schema-retry abaixo
      if (attempt === RL_DELAYS_MS.length - 1) throw err;
      const retryAfterHdr = anyErr.response?.headers?.get?.("retry-after");
      const retryAfterMs = retryAfterHdr ? Number(retryAfterHdr) * 1000 : NaN;
      const wait = Number.isFinite(retryAfterMs) && retryAfterMs > 0
        ? Math.min(retryAfterMs, 5000)
        : RL_DELAYS_MS[attempt];
      console.warn(`[classify] ${label} 429 detected, sleeping ${wait}ms (attempt ${attempt + 1}/${RL_DELAYS_MS.length})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  // Fluxo legado: 1 retry para schema-mismatch / transientes 5xx / network.
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const anyErr = err as { text?: string; cause?: unknown };
    if (anyErr.text || anyErr.cause) {
      const causeMsg = anyErr.cause instanceof Error ? anyErr.cause.message : JSON.stringify(anyErr.cause);
      console.warn(
        `[classify] ${label} schema mismatch — modelText=<<<${String(anyErr.text ?? "").slice(0, 200)}>>> causeFull=<<<${String(causeMsg).slice(0, 1500)}>>>`,
      );
    }
    const isSchema = /did not match schema|No object generated|Output validation/i.test(msg);
    const isTransient = /timeout|fetch failed|network|ECONN|5\d\d/i.test(msg);
    if (!isSchema && !isTransient) throw err;
    console.warn(`[classify] ${label} retry after: ${msg.slice(0, 160)}`);
    return await fn();
  }
}


// Modelos por provider. `pickModel(ai.provider, ...)` escolhe em runtime.
// Lovable AI: Gemini via Lovable Gateway (créditos do workspace, teto rígido).
// OpenAI BYOK: legado, mantido para rollback via CLASSIFIER_PROVIDER=openai.
const SUMMARIZER_SPEC          = { openai: "gpt-4o",      lovable: "google/gemini-2.5-flash" };
const SUMMARIZER_FALLBACK_SPEC = { openai: "gpt-5-mini",  lovable: "google/gemini-2.5-flash-lite" };
const AGENDADOR_SPEC           = { openai: "gpt-5-nano",  lovable: "google/gemini-2.5-flash-lite" };
const TYPIFIER_SPEC            = { openai: "gpt-5-mini",  lovable: "google/gemini-2.5-flash" };
const MOVIMENTADOR_SPEC        = { openai: "gpt-5-nano",  lovable: "google/gemini-2.5-flash-lite" };
const MAESTRO_SPEC             = { openai: "gpt-5",       lovable: "google/gemini-2.5-flash" };

export const AGENT_MODEL = "classifier"; // legado — não é mais um id único

// ===== Agente 1: Resumidor =====

function buildSummarizerSystem(): string {
  return `Você é um extrator clínico para CRM médico.
Tarefa: ler o histórico recente deste paciente e produzir um resumo factual
de 3 a 4 linhas em PT-BR. Separe claramente PASSADO (tratamentos, pagamentos,
consultas já realizadas) de PRESENTE (o que o lead quer, recusou ou pediu na
ÚLTIMA mensagem). Não invente nada que não esteja no histórico.

IMPORTANTÍSSIMO NO RESUMO:
- **AUTORIDADE DA SECRETÁRIA**: A palavra da secretária vale mais que a do paciente. Se o paciente diz "já paguei", mas a secretária não confirmou nem enviou comprovante, você DEVE escrever: "Paciente alega ter pago, mas não há confirmação da clínica". SÓ AFIRME "pagamento recebido" ou "agendamento confirmado" se a *secretária* confirmar de forma clara.
- Se o paciente mencionar a MODALIDADE de atendimento (ex: "presencial", "online", "teleconsulta"), você DEVE citar isso no resumo.
- Se o paciente mencionar QUALQUER campo personalizado ou dado cadastral importante, inclua no resumo.

Além do resumo, devolva "mentioned_dates" contendo as datas citadas pelo paciente ou pela secretária.
NÃO converta datas — devolva a string crua exatamente como aparece ("amanhã às 15h", "quinta-feira", "dia 24/06") e "anchor_iso" = o
timestamp ISO da MENSAGEM que cita a data. "kind": "consulta" para primeiras
consultas/avaliações/retornos; "procedimento" para procedimento/tratamento agendado.

CRÍTICO — REGRA OBRIGATÓRIA SOBRE DATAS:
Se você escrever QUALQUER referência a data/horário no campo "summary", você é OBRIGADO a replicar essa data no array "mentioned_dates". NUNCA deixe "mentioned_dates" vazio se o summary cita uma data.

Exemplos few-shot (siga este padrão à risca):

EX1 — paciente confirma horário proposto pela secretária:
Histórico:
[2026-06-18T10:00:00-03:00] Secretária: Posso agendar para 19/06 às 10h com Dr. Ivan?
[2026-06-18T10:05:00-03:00] Paciente: Pode sim, confirmado!
Summary correto: "PRESENTE: Paciente confirmou consulta presencial com Dr. Ivan em 19/06 às 10:00."
mentioned_dates correto: [{ "raw": "19/06 às 10h", "anchor_iso": "2026-06-18T10:00:00-03:00", "kind": "consulta" }]

IMPORTANTE: responda APENAS com um objeto JSON válido seguindo o schema.`;
}

async function runSummarizer(
  ai: ClassifierAi,
  ctx: LeadContext,
): Promise<{ output: SummarizerOutput; model: string; usage?: unknown }> {
  const prompt = `${buildContextBlock(ctx)}

Histórico de mensagens (lead id=${ctx.lead.id}):

${formatMessages(ctx.messages)}

Produza o resumo agora.`;

  const tryModel = async (modelId: string) =>
    withSchemaRetry(`summarizer(${modelId})`, () =>
      generateText({
        model: ai.model(modelId),
        system: buildSummarizerSystem(),
        prompt,
        output: Output.object({ schema: SummarizerOutputSchema }),
      }),
    );


  try {
    const result = await tryModel(SUMMARIZER_MODEL_PRIMARY);
    return { output: result.output as SummarizerOutput, model: SUMMARIZER_MODEL_PRIMARY, usage: (result as { usage?: unknown }).usage };
  } catch (err) {
    try {
      const result = await tryModel(SUMMARIZER_MODEL_FALLBACK);
      return { output: result.output as SummarizerOutput, model: `${SUMMARIZER_MODEL_FALLBACK} (fallback)`, usage: (result as { usage?: unknown }).usage };
    } catch (err2) {
      throw err2;
    }
  }
}

// ===== Agente 2: Agendador =====

function buildAgendadorSystem(): string {
  return `Você é o Agendador do CRM médico. Baseie-se SOMENTE no resumo factual.
Sua única função é descobrir se a mensagem trata de uma ação de agenda.
Não tente deduzir data exata (o parser já fez isso). Foque na INTENÇÃO.

"scheduling_intent": "novo_agendamento", "reagendamento", "cancelamento", "duvida_agenda" ou "nenhum".
"is_scheduling_action": true se for novo, reagendamento ou cancelamento.
"reasons": Justifique sua decisão com base no resumo.

IMPORTANTE: responda APENAS com um objeto JSON válido.`;
}

async function runAgendador(ai: ClassifierAi, ctx: LeadContext, summary: string): Promise<{ output: AgendadorOutput; usage?: unknown }> {
  const result = await withSchemaRetry("agendador", () =>
    generateText({
      model: ai.model(pickModel(ai.provider, AGENDADOR_SPEC)),
      system: buildAgendadorSystem(),
      prompt: `RESUMO factual do lead:\n${summary}`,
      output: Output.object({ schema: AgendadorOutputSchema }),
    }),
  );
  return { output: result.output as AgendadorOutput, usage: (result as { usage?: unknown }).usage };
}


// ===== Agente 3: Preenchedor (Tipificador) =====

// Chaves canônicas hardcoded — usadas como FALLBACK quando a clínica não
// declarou nenhum lead_custom_fields. Preserva o comportamento anterior.
const FALLBACK_TYPIFIER_KEYS = `  1. "status_financeiro": ("pago", "pendente", "parcial", "atrasado", "nao_aplicavel")
     **ATENÇÃO**: SÓ USE "pago" SE O RESUMO AFIRMAR QUE A SECRETÁRIA CONFIRMOU O PAGAMENTO. Se o paciente apenas alega, NÃO coloque "pago". Em vez disso, coloque a tag "pagamento_alegado".
  2. "interesse_consulta": array de string (ex: ["ivan", "maisa"])
  3. "interesse_tratamento": array de string (ex: ["cetamina", "emt", "hipnose", "outro", "nenhum"])
  4. "nome_responsavel_financeiro": string
  5. "possui_liminar_judicial": boolean
  6. "saldo_sessoes_pacote": number
  7. "motivo_cancelamento": string
  8. "eh_paciente_antigo": boolean — true quando há evidência clara de que já é paciente da clínica (histórico mencionado, retorno, sessão prévia, "minha última consulta", etc).`;

function describeFieldType(def: ClinicFieldDef): string {
  switch (def.field_type) {
    case "select":
      return def.options.length
        ? `string — UM dos valores: [${def.options.map((o) => JSON.stringify(o)).join(", ")}]`
        : "string";
    case "multiselect":
      return def.options.length
        ? `array de string — subconjunto de: [${def.options.map((o) => JSON.stringify(o)).join(", ")}]`
        : "array de string";
    case "boolean":
      return "boolean (true/false)";
    case "number":
      return "number";
    case "textarea":
      return "string (texto livre, várias linhas)";
    case "text":
    default:
      return "string";
  }
}

/** Monta a seção de chaves do prompt do Preenchedor a partir do schema
 *  declarado pela clínica. Schema vazio → fallback hardcoded. */
function buildTypifierKeysBlock(schema: ClinicFieldDef[]): string {
  if (!schema.length) return FALLBACK_TYPIFIER_KEYS;
  return schema
    .map((def, idx) => {
      const desc = describeFieldType(def);
      const special =
        def.field_key === "status_financeiro"
          ? `\n     **ATENÇÃO**: SÓ USE "pago" SE A SECRETÁRIA CONFIRMOU O PAGAMENTO. Se o paciente apenas alega, NÃO coloque "pago" — use a tag "pagamento_alegado".`
          : "";
      return `  ${idx + 1}. "${def.field_key}" (${def.label}): ${desc}${special}`;
    })
    .join("\n");
}

function buildTypifierSystem(schema: ClinicFieldDef[], allowedTags: string[]): string {
  const keysBlock = buildTypifierKeysBlock(schema);
  // P7+P20: whitelist agora vem de app_settings.automation.v42.allowed_tags
  // (carregada em context.ts). Fallback para lista mínima quando o setting
  // não existe — preserva comportamento anterior sem perder validação.
  const FALLBACK_TAGS = [
    "welcome_sent", "b2b_auto", "urgencia_clinica", "reativacao", "no_show",
    "reagendamento_pendente", "reagendamento_solicitado", "aguardando_nova_data",
    "pagamento_alegado", "consulta_agendada", "tratamento_em_andamento",
    "agendamento_sugerido", "judicializacao", "precisa_atencao_humana",
  ];
  const tagList = allowedTags.length ? allowedTags : FALLBACK_TAGS;
  return `Você é o Preenchedor do CRM médico. Baseie-se SOMENTE no resumo + campos atuais do lead.

Tarefa:
- "tags_suggested": liste tags da whitelist abaixo que se aplicam ao lead (use o slug EXATO; tags fora desta lista serão descartadas):
  [${tagList.join(", ")}]

- "custom_fields_patch": objeto com chaves a atualizar. VOCÊ SÓ PODE PREENCHER AS SEGUINTES CHAVES (declaradas pela clínica). NÃO invente chaves fora desta lista — elas serão descartadas:
${keysBlock}

  CRÍTICO (GATE 11): NUNCA inclua as chaves "consulta_agendada_em", "procedimento_agendado_em" ou "sessions_requested" (preenchidas pelo parser de datas).

Se incerto sobre qualquer chave ou tag, NÃO invente — \`custom_fields_patch: {}\` e \`tags_suggested: []\` são respostas válidas.

IMPORTANTE: responda APENAS em JSON válido seguindo o schema.`;
}

async function runTypifier(ai: ClassifierAi, ctx: LeadContext, summary: string): Promise<{ output: TypifierOutput; usage?: unknown }> {
  const result = await withSchemaRetry("typifier", () =>
    generateText({
      model: ai.model(pickModel(ai.provider, TYPIFIER_SPEC)),
      system: buildTypifierSystem(ctx.clinicFieldSchema, ctx.allowedTags),

      prompt: `${buildContextBlock(ctx)}

RESUMO factual do lead:
${summary}`,
      output: Output.object({ schema: TypifierOutputSchema }),
    }),
  );
  return { output: result.output as TypifierOutput, usage: (result as { usage?: unknown }).usage };
}


// ===== Agente 4: Movimentador =====

function buildMovimentadorSystem(): string {
  return `Você é o Movimentador de Funil do CRM médico. Define stage e intent baseando-se SOMENTE no resumo factual e sinais.
Pipeline canônico (use EXATAMENTE estes nomes em stage_suggestion):
${CANON_NAMES.map((n) => `- ${n}`).join("\n")}

Diretrizes de stage:
- "Novo": primeira interação.
- "Qualificação": atendente em descoberta ativa; em diálogo.
- "Consulta agendada"/"Tratamento agendado": agendamento confirmado.
- "Consulta finalizada"/"1ª Sessão Finalizada": atendimento realizado (data da consulta já passou e não há sinal claro de no-show).
- "Sem resposta": parou de responder em fase inicial.
- "Nutrição inativa": (a) silêncio longo, ou (b) Interesse claro MAS sem fechamento de agendamento (objeção, parou de responder após preço).
- "Paciente antigo": já fez consulta/tratamento antes E o ciclo atual encerrou. **Regra adicional**: se o lead pede RENOVAÇÃO DE RECEITA, segunda via de prescrição, ou continuação de medicação prévia, e há qualquer sinal de consulta anterior (treated_before=true, has_paciente_antigo_tag=true, "minha última consulta", "Dr. X já me atendeu"), o stage é "Paciente antigo" — NÃO "Qualificação".

Regras CRÍTICAS para is_b2b / "B2B / Stakeholders":
- B2B é APENAS para parceiros institucionais: representantes comerciais de laboratórios/distribuidores, fornecedores, parcerias entre clínicas, jornalistas, recrutadores, propostas comerciais para a clínica.
- NÃO é B2B: profissionais de saúde (psicólogo, médico, enfermeiro, etc.) que estão buscando tratamento PRÓPRIO ou para si mesmos → são pacientes normais.
- NÃO é B2B: alguém comprando/agendando tratamento PARA TERCEIROS (familiar, chefe, filho, paciente próprio) — o pagador não é o paciente, mas o fluxo é de paciente. Use stage de paciente normal e registre o beneficiário em custom_fields.
- Em dúvida entre paciente e B2B: assuma PACIENTE.

Intents (escolha UM em "intent"):
${INTENT_VALUES.map((i) => `- ${i}`).join("\n")}

IMPORTANTE: responda APENAS com um objeto JSON válido seguindo o schema.`;
}


async function runMovimentador(ai: ClassifierAi, ctx: LeadContext, summary: string): Promise<{ output: MovimentadorOutput; usage?: unknown }> {
  const lastMsg = ctx.messages[ctx.messages.length - 1];
  const lastMsgMs = lastMsg ? Date.parse(lastMsg.created_at) : null;
  const hoursSinceLastMessage = lastMsgMs ? Math.round(((ctx.nowMs - lastMsgMs) / 3_600_000) * 10) / 10 : null;

  const signals = {
    current_stage: ctx.stageName,
    treated_before: ctx.hasBeenTreatedBefore,
    has_paciente_antigo_tag: ctx.lead.tags.includes("paciente_antigo"),
    hours_since_last_message: hoursSinceLastMessage,
    last_message_from_attendant: lastMsg ? lastMsg.from_me === true : null,
  };

  const result = await withSchemaRetry("movimentador", () =>
    generateText({
      model: ai.model(pickModel(ai.provider, MOVIMENTADOR_SPEC)),
      system: buildMovimentadorSystem(),
      prompt: `Sinais determinísticos:
${JSON.stringify(signals, null, 2)}

RESUMO:
${summary}`,
      output: Output.object({ schema: MovimentadorOutputSchema }),
    }),
  );
  return { output: result.output as MovimentadorOutput, usage: (result as { usage?: unknown }).usage };
}


// ===== Agente 5: Maestro =====

function buildMaestroSystem(): string {
  return `Você é o Maestro Validador Final (O Juiz) do CRM médico. Você recebe as opiniões de 3 agentes especialistas (Agendador, Preenchedor, Movimentador) + sinais determinísticos do lead.
Sua tarefa é cruzar essas informações, resolver contradições e emitir a Classificação CANÔNICA perfeita.

REGRAS DE RESOLUÇÃO DE CONFLITO (P2):
1. Conflito agendamento × desqualificação → desqualificação SEMPRE vence (intent='desistencia'|'objecao', custom_fields.qualificacao='desqualificado'). Nunca sugira mover para "Consulta agendada" se houver sinal de desistência.
2. Se SIGNALS.manual_lock_until estiver no futuro → NÃO mover (mantenha stage atual). Tags e custom_fields podem ser aplicados normalmente.
3. Se SIGNALS.has_precisa_atencao_humana=true → NÃO mover de stage (humano vai revisar). Tags e custom_fields ok.
4. Se a confiança média dos 3 agentes for < 0.6 → emita mode='stage_suggestion_only' e confidence baixa (≤0.6) — a sugestão fica registrada mas não move o card.

Exemplo de contradição:
- O Agendador diz "reagendamento", mas o Movimentador sugere stage "Novo".
-> Você corrige: O stage correto de reagendamento pendente é "Qualificação" (se não há data ainda).

Regras de Autoridade:
- Para intenções de agenda, confie mais no Agendador.
- Para tags e campos, confie no Preenchedor.
- Para movimentação de funil, confie no Movimentador, mas evite movimentos bruscos ilógicos.
- Se a inteligência deles falhou (ex: Preenchedor colocou status "pago" mas o resumo diz que a secretária não confirmou), CORRIJA IMEDIATAMENTE (Gate 10 de segurança).

Devolva todos os campos exigidos.`;
}

async function runMaestro(
  ai: ClassifierAi,
  summary: string,
  outAgendador: AgendadorOutput,
  outPreenchedor: TypifierOutput,
  outMovimentador: MovimentadorOutput,
  signals: Record<string, unknown>,
): Promise<{ output: MaestroOutput; usage?: unknown }> {
  const result = await withSchemaRetry("maestro", () =>
    generateText({
      model: ai.model(pickModel(ai.provider, MAESTRO_SPEC)),
      system: buildMaestroSystem(),
      prompt: `RESUMO Factual:
${summary}

SIGNALS determinísticos do lead:
${JSON.stringify(signals, null, 2)}

OPINIÕES DOS AGENTES:
Agendador: ${JSON.stringify(outAgendador, null, 2)}
Preenchedor: ${JSON.stringify(outPreenchedor, null, 2)}
Movimentador: ${JSON.stringify(outMovimentador, null, 2)}

Emita o veredicto final resolvendo inconsistências.`,
      output: Output.object({ schema: MaestroOutputSchema }),
    }),
  );
  return { output: result.output as MaestroOutput, usage: (result as { usage?: unknown }).usage };
}



// ===== Orquestração =====

export type AgentMode = "full";

export type RunAgentSuccess = {
  classification: ClassificationV2;
  usage?: unknown;
  mode: AgentMode;
  agents?: {
    summarizer_model: string;
    agendador_model: string;
    typifier_model: string;
    movimentador_model: string;
    maestro_model: string;
    summary_chars: number;
    summary: string;
    latency_ms: { summarizer: number; agendador: number; typifier: number; movimentador: number; maestro: number };
    ran: { summarizer: boolean; agendador: boolean; typifier: boolean; movimentador: boolean; maestro: boolean };
  };
};

export async function runAgent(
  client: SupabaseClient,
  ctx: LeadContext,
  opts: { historyToolEnabled: boolean; onlyAgent?: AgentMode },
): Promise<RunAgentSuccess | { error: string }> {
  const ai = await getClinicOpenAI(client, ctx.lead.clinic_id);
  if (!ai) return { error: "no_clinic_openai_key" };

  // ----- Passo 1 — Resumidor -----
  let summary: string;
  let summarizerModel = SUMMARIZER_MODEL_PRIMARY;
  let mentionedDates: SummarizerOutput["mentioned_dates"] = [];
  let usage1: unknown;
  const t1 = performance.now();

  try {
    const r1 = await runSummarizer(ai, ctx);
    summary = r1.output.summary;
    mentionedDates = r1.output.mentioned_dates ?? [];
    summarizerModel = r1.model;
    usage1 = r1.usage;
    await safeRecordStep({ ctx, model: summarizerModel.split(" ")[0], operation: "classifier:summarizer", status: "success", latencyMs: performance.now() - t1, usage: usage1 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await safeRecordStep({ ctx, model: SUMMARIZER_MODEL_PRIMARY, operation: "classifier:summarizer", status: "error", latencyMs: performance.now() - t1, error: msg.slice(0, 500) });
    return { error: `agent_step1_failed: ${msg.slice(0, 200)}` };
  }
  const lat1 = performance.now() - t1;

  // ----- Passo 2 — Paralelo (Agendador, Preenchedor, Movimentador) -----
  let outAgendador: AgendadorOutput | null = null;
  let outPreenchedor: TypifierOutput | null = null;
  let outMovimentador: MovimentadorOutput | null = null;
  let usage2: any = {};
  let lat2 = 0;
  const t2 = performance.now();

  // P12: se TODAS as chaves do schema da clínica estão protegidas por G10
  // (editadas por humano há <7d), o Preenchedor seria 100% descartado por
  // apply.ts. Pula o agente para economizar tokens — Agendador e
  // Movimentador continuam (não tocam custom_fields).
  const G10_MS = 7 * 24 * 60 * 60_000;
  const lastEdits = ctx.lead.custom_fields_last_human_edit ?? {};
  const allKeysProtected =
    ctx.clinicFieldSchema.length > 0 &&
    ctx.clinicFieldSchema.every((f) => {
      const iso = lastEdits[f.field_key];
      if (!iso) return false;
      const ms = Date.parse(iso);
      return Number.isFinite(ms) && ctx.nowMs - ms < G10_MS;
    });

  try {
    const typifierTask = allKeysProtected
      ? Promise.resolve({
          output: { tags_suggested: [], custom_fields_patch: {}, reasons: ["skipped:all_keys_g10_protected"] } as TypifierOutput,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          skipped: true as const,
        })
      : runTypifier(ai, ctx, summary).then((r) => ({ ...r, skipped: false as const }));

    const [rAg, rPr, rMo] = await Promise.all([
      runAgendador(ai, ctx, summary),
      typifierTask,
      runMovimentador(ai, ctx, summary)
    ]);
    outAgendador = rAg.output;
    outPreenchedor = rPr.output;
    outMovimentador = rMo.output;
    usage2 = { ag: rAg.usage, pr: rPr.usage, mo: rMo.usage, typifier_skipped: rPr.skipped };
    const stepLat = performance.now() - t2;
    await Promise.all([
      safeRecordStep({ ctx, model: AGENDADOR_MODEL, operation: "classifier:agendador", status: "success", latencyMs: stepLat, usage: usage2.ag }),
      rPr.skipped
        ? Promise.resolve()
        : safeRecordStep({ ctx, model: TYPIFIER_MODEL, operation: "classifier:typifier", status: "success", latencyMs: stepLat, usage: usage2.pr }),
      safeRecordStep({ ctx, model: MOVIMENTADOR_MODEL, operation: "classifier:movimentador", status: "success", latencyMs: stepLat, usage: usage2.mo })
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stepLat = performance.now() - t2;
    await Promise.all([
      safeRecordStep({ ctx, model: AGENDADOR_MODEL, operation: "classifier:agendador", status: "error", latencyMs: stepLat, error: msg.slice(0, 500) }),
      safeRecordStep({ ctx, model: TYPIFIER_MODEL, operation: "classifier:typifier", status: "error", latencyMs: stepLat, error: msg.slice(0, 500) }),
      safeRecordStep({ ctx, model: MOVIMENTADOR_MODEL, operation: "classifier:movimentador", status: "error", latencyMs: stepLat, error: msg.slice(0, 500) })
    ]);
    return { error: `agent_step2_parallel_failed: ${msg.slice(0, 200)}` };
  }
  lat2 = performance.now() - t2;

  // ----- Passo 3 — Maestro -----
  let maestroOut: MaestroOutput | null = null;
  let usage3: unknown;
  const t3 = performance.now();

  // P2: sinais determinísticos para regras de conflito do Maestro.
  const maestroSignals = {
    manual_lock_until: ctx.lead.manual_lock_until,
    has_precisa_atencao_humana: ctx.lead.tags.includes("precisa_atencao_humana"),
    current_stage: ctx.stageName,
    treated_before: ctx.hasBeenTreatedBefore,
    typifier_skipped: allKeysProtected,
  };

  try {
    const r3 = await runMaestro(ai, summary, outAgendador, outPreenchedor, outMovimentador, maestroSignals);
    maestroOut = r3.output;
    usage3 = r3.usage;
    await safeRecordStep({ ctx, model: MAESTRO_MODEL, operation: "classifier:maestro", status: "success", latencyMs: performance.now() - t3, usage: usage3 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await safeRecordStep({ ctx, model: MAESTRO_MODEL, operation: "classifier:maestro", status: "error", latencyMs: performance.now() - t3, error: msg.slice(0, 500) });
    return { error: `agent_step3_maestro_failed: ${msg.slice(0, 200)}` };
  }


  const lat3 = performance.now() - t3;

  const summarizerOut: SummarizerOutput = { summary, mentioned_dates: mentionedDates };

  return {
    classification: mergeV6Outputs(summarizerOut, maestroOut),
    usage: { agent1: usage1, agent2_parallel: usage2, agent3: usage3 },
    mode: "full",
    agents: {
      summarizer_model: summarizerModel,
      agendador_model: AGENDADOR_MODEL,
      typifier_model: TYPIFIER_MODEL,
      movimentador_model: MOVIMENTADOR_MODEL,
      maestro_model: MAESTRO_MODEL,
      summary_chars: summary.length,
      summary,
      latency_ms: {
        summarizer: Math.round(lat1),
        agendador: Math.round(lat2),
        typifier: Math.round(lat2),
        movimentador: Math.round(lat2),
        maestro: Math.round(lat3)
      },
      ran: { summarizer: true, agendador: true, typifier: !allKeysProtected, movimentador: true, maestro: true },
    },
  };
}

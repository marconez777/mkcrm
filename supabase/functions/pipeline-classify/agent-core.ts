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
import { withTimeout } from "../_shared/utils.ts";

// P0-1: timeout por subagente para impedir que um único modelo trave consuma
// todo o orçamento de 120s do executor (`CLASSIFY_TIMEOUT_MS`).
// Worst-case: 30 + 25 (paralelo) + 40 = 95s, abaixo do teto do executor.
const TIMEOUT_SUMMARIZER_MS   = 30_000;
const TIMEOUT_PARALLEL_MS     = 25_000; // Agendador / Preenchedor / Movimentador rodam em Promise.all
const TIMEOUT_MAESTRO_MS      = 40_000;
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

const AGENT_CORE_REV = "phase15-allsettled-source-jsonfallback-v2";

type ErrorCategory =
  | "schema_validation"
  | "quota_or_billing"
  | "rate_limit"
  | "timeout"
  | "gateway_5xx"
  | "network"
  | "no_provider"
  | "unknown";

type SafeSchema<T> = {
  safeParse: (value: unknown) =>
    | { success: true; data: T }
    | { success: false; error: { message: string } };
};

function inferProvider(model: string): "lovable" | "openai" | null {
  if (/^google\//i.test(model) || /gemini/i.test(model)) return "lovable";
  if (/^(gpt-|o\d|chatgpt)/i.test(model)) return "openai";
  return null;
}

function agentStepFromOperation(operation: string): string | null {
  return operation.startsWith("classifier:") ? operation.split(":")[1] ?? null : null;
}

function categorizeAgentError(error: string | null | undefined): ErrorCategory | null {
  if (!error) return null;
  if (/quota|insufficient_quota|billing|payment required|\b402\b|exceeded your current/i.test(error)) return "quota_or_billing";
  if (/rate.?limit|too many requests|\b429\b/i.test(error)) return "rate_limit";
  if (/timeout|timed out/i.test(error)) return "timeout";
  if (/No object generated|schema_retry_failed|did not match schema|Output validation/i.test(error)) return "schema_validation";
  if (/fetch failed|network|ECONN|ENOTFOUND|EAI_AGAIN/i.test(error)) return "network";
  if (/\b5\d\d\b/.test(error)) return "gateway_5xx";
  if (/no_ai_provider/i.test(error)) return "no_provider";
  return "unknown";
}

function isSchemaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /No object generated|schema_retry_failed|did not match schema|Output validation/i.test(msg);
}

function extractJsonObject(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("json_object_not_found");
  }
}

async function withJsonFallback<T>(opts: {
  label: string;
  schema: SafeSchema<T>;
  structured: () => Promise<{ output?: unknown; usage?: unknown }>;
  textFallback: () => Promise<{ text?: string; usage?: unknown }>;
}): Promise<{ output: T; usage?: unknown; fallbackUsed: boolean }> {
  try {
    const result = await withSchemaRetry(opts.label, opts.structured);
    return { output: result.output as T, usage: result.usage, fallbackUsed: false };
  } catch (err) {
    if (!isSchemaError(err)) throw err;
    console.warn(`[classify] ${opts.label} structured output failed; trying compact JSON fallback`);
    const result = await withSchemaRetry(`${opts.label}:json_fallback`, opts.textFallback);
    const parsed = extractJsonObject(result.text ?? "");
    const checked = opts.schema.safeParse(parsed);
    if (!checked.success) {
      throw new Error(`${opts.label}_json_fallback_failed: ${checked.error.message.slice(0, 180)}`);
    }
    return { output: checked.data, usage: result.usage, fallbackUsed: true };
  }
}

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
  provider?: "lovable" | "openai" | null;
  details?: Record<string, unknown>;
}) {
  const tokens = extractTokens(opts.usage);
  const errorCategory = categorizeAgentError(opts.error);
  const provider = opts.provider ?? inferProvider(opts.model);
  const agentStep = agentStepFromOperation(opts.operation);
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
    source: "classifier-runtime",
    provider,
    agent_step: agentStep,
    error_category: errorCategory,
    error_details: {
      rev: AGENT_CORE_REV,
      agent_step: agentStep,
      provider,
      model: opts.model,
      retryable: errorCategory != null && ["schema_validation", "rate_limit", "timeout", "gateway_5xx", "network", "quota_or_billing"].includes(errorCategory),
      ...opts.details,
    },
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
      const baseWait = Number.isFinite(retryAfterMs) && retryAfterMs > 0
        ? Math.min(retryAfterMs, 5000)
        : RL_DELAYS_MS[attempt];
      // P5-4: jitter ±20% para evitar thundering herd quando o executor
      // dispara vários leads em paralelo e todos tomam 429 ao mesmo tempo.
      const wait = Math.round(baseWait * (0.8 + Math.random() * 0.4));
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
    try {
      return await fn();
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      const retryAny = retryErr as { text?: string; cause?: unknown };
      const causeMsg = retryAny.cause instanceof Error ? retryAny.cause.message : JSON.stringify(retryAny.cause);
      console.error(
        `[classify] ${label} retry FAILED — modelText=<<<${String(retryAny.text ?? "").slice(0, 200)}>>> cause=<<<${String(causeMsg).slice(0, 500)}>>>`,
      );
      throw new Error(`${label}_schema_retry_failed: ${retryMsg.slice(0, 160)}`);
    }
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
- **REGRA DA PRIMEIRA MENSAGEM**: Se o Contexto trouxer `PRIMEIRA_MENSAGEM_TEMPLATE: true`, trate a única mensagem do lead como texto pré-fabricado de botão/anúncio. NÃO use essa mensagem para inferir interesse real do paciente. Use-a SOMENTE para extrair `origem` quando houver rastreio explícito (Google/Instagram/Facebook/Indicação). O resumo do PRESENTE deve registrar apenas "Lead chegou via [origem se disponível] — ainda sem interação real" até que a 2ª mensagem do lead apareça.

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
      withTimeout(
        generateText({
          model: ai.model(modelId),
          system: buildSummarizerSystem(),
          prompt,
          output: Output.object({ schema: SummarizerOutputSchema }),
        }),
        TIMEOUT_SUMMARIZER_MS,
        `summarizer(${modelId})`,
      ),
    );


  const primary = pickModel(ai.provider, SUMMARIZER_SPEC);
  const fallback = pickModel(ai.provider, SUMMARIZER_FALLBACK_SPEC);
  try {
    const result = await tryModel(primary);
    return { output: result.output as SummarizerOutput, model: primary, usage: (result as { usage?: unknown }).usage };
  } catch (_err) {
    const result = await tryModel(fallback);
    return { output: result.output as SummarizerOutput, model: `${fallback} (fallback)`, usage: (result as { usage?: unknown }).usage };
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

async function runAgendador(ai: ClassifierAi, ctx: LeadContext, summary: string): Promise<{ output: AgendadorOutput; usage?: unknown; fallbackUsed?: boolean }> {
  const modelId = pickModel(ai.provider, AGENDADOR_SPEC);
  const prompt = `RESUMO factual do lead:\n${summary}`;
  const result = await withJsonFallback<AgendadorOutput>({
    label: "agendador",
    schema: AgendadorOutputSchema,
    structured: () => withTimeout(
      generateText({
        model: ai.model(modelId),
        system: buildAgendadorSystem(),
        prompt,
        output: Output.object({ schema: AgendadorOutputSchema }),
      }),
      TIMEOUT_PARALLEL_MS,
      "agendador",
    ),
    textFallback: () => withTimeout(
      generateText({
        model: ai.model(modelId),
        system: `${buildAgendadorSystem()}\nResponda somente JSON compacto, sem markdown. Campos: is_scheduling_action boolean, scheduling_intent string, reasons array de strings.`,
        prompt,
      }),
      TIMEOUT_PARALLEL_MS,
      "agendador:json_fallback",
    ),
  });
  return { output: result.output, usage: result.usage, fallbackUsed: result.fallbackUsed };
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

REGRA DA PRIMEIRA MENSAGEM: Se o Contexto trouxer \`PRIMEIRA_MENSAGEM_TEMPLATE: true\`, NÃO preencha "interesse_consulta", "interesse_tratamento" nem qualquer campo relacionado a intenção/objetivo do paciente — a única mensagem dele é texto pré-fabricado de botão/anúncio. A ÚNICA chave que pode ser inferida nesse cenário é "origem" (se houver rastreio explícito como "vim do Google"). Demais campos devem ficar vazios até a 2ª mensagem real do lead.

ORIGEM (sticky humano): NUNCA sobrescreva "origem" se já houver valor preenchido e edição humana registrada — o executor protegerá, mas evite redundância: se "origem" já tem valor no Contexto, omita do patch.

Se incerto sobre qualquer chave ou tag, NÃO invente — \`custom_fields_patch: {}\` e \`tags_suggested: []\` são respostas válidas.

IMPORTANTE: responda APENAS em JSON válido seguindo o schema.`;
}

async function runTypifier(ai: ClassifierAi, ctx: LeadContext, summary: string): Promise<{ output: TypifierOutput; usage?: unknown; fallbackUsed?: boolean }> {
  const modelId = pickModel(ai.provider, TYPIFIER_SPEC);
  const system = buildTypifierSystem(ctx.clinicFieldSchema, ctx.allowedTags);
  const prompt = `${buildContextBlock(ctx)}

RESUMO factual do lead:
${summary}`;
  const result = await withJsonFallback<TypifierOutput>({
    label: "typifier",
    schema: TypifierOutputSchema,
    structured: () => withTimeout(
      generateText({
        model: ai.model(modelId),
        system,
        prompt,
        output: Output.object({ schema: TypifierOutputSchema }),
      }),
      TIMEOUT_PARALLEL_MS,
      "typifier",
    ),
    textFallback: () => withTimeout(
      generateText({
        model: ai.model(modelId),
        system: `${system}\nResponda somente JSON compacto, sem markdown. Campos: tags_suggested array de strings, custom_fields_patch objeto.`,
        prompt,
      }),
      TIMEOUT_PARALLEL_MS,
      "typifier:json_fallback",
    ),
  });
  return { output: result.output, usage: result.usage, fallbackUsed: result.fallbackUsed };
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

🚨 TRANSIÇÃO AGENDAMENTO HUMANO (Junho/2026) — TRAVA ESTRITA:
- Você está TERMINANTEMENTE PROIBIDO de sugerir stage_suggestion = "Consulta agendada", "Tratamento agendado", "Consulta finalizada" ou "1ª Sessão Finalizada".
- Mesmo que o lead diga "está marcada minha consulta dia X" ou "consulta confirmada", você DEVE manter o stage atual (geralmente "Qualificação"). A secretária é a ÚNICA fonte de verdade desses estágios.
- Se identificar intenção/confirmação de agendamento, registre em reasons e mantenha o stage atual.

Regras CRÍTICAS para is_b2b / "B2B / Stakeholders":
- B2B é APENAS para parceiros institucionais: representantes comerciais de laboratórios/distribuidores, fornecedores, parcerias entre clínicas, jornalistas, recrutadores, propostas comerciais para a clínica.
- NÃO é B2B: profissionais de saúde (psicólogo, médico, enfermeiro, etc.) que estão buscando tratamento PRÓPRIO ou para si mesmos → são pacientes normais.
- NÃO é B2B: alguém comprando/agendando tratamento PARA TERCEIROS (familiar, chefe, filho, paciente próprio) — o pagador não é o paciente, mas o fluxo é de paciente. Use stage de paciente normal e registre o beneficiário em custom_fields.
- Em dúvida entre paciente e B2B: assuma PACIENTE.

Intents (escolha UM em "intent"):
${INTENT_VALUES.map((i) => `- ${i}`).join("\n")}

IMPORTANTE: responda APENAS com um objeto JSON válido seguindo o schema.`;
}


async function runMovimentador(ai: ClassifierAi, ctx: LeadContext, summary: string): Promise<{ output: MovimentadorOutput; usage?: unknown; fallbackUsed?: boolean }> {
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

  const modelId = pickModel(ai.provider, MOVIMENTADOR_SPEC);
  const system = buildMovimentadorSystem();
  const prompt = `Sinais determinísticos:
${JSON.stringify(signals, null, 2)}

RESUMO:
${summary}`;

  const result = await withJsonFallback<MovimentadorOutput>({
    label: "movimentador",
    schema: MovimentadorOutputSchema,
    structured: () => withTimeout(
      generateText({
        model: ai.model(modelId),
        system,
        prompt,
        output: Output.object({ schema: MovimentadorOutputSchema }),
      }),
      TIMEOUT_PARALLEL_MS,
      "movimentador",
    ),
    textFallback: () => withTimeout(
      generateText({
        model: ai.model(modelId),
        system: `${system}\nResponda somente JSON compacto, sem markdown. Campos: stage_suggestion string, intent string, mentioned_intents array, is_b2b boolean, reasons array.`,
        prompt,
      }),
      TIMEOUT_PARALLEL_MS,
      "movimentador:json_fallback",
    ),
  });
  return { output: result.output, usage: result.usage, fallbackUsed: result.fallbackUsed };
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

🚨 TRANSIÇÃO AGENDAMENTO HUMANO (Junho/2026) — TRAVA ESTRITA:
- Você está TERMINANTEMENTE PROIBIDO de validar/emitir stage_suggestion = "Consulta agendada", "Tratamento agendado", "Consulta finalizada" ou "1ª Sessão Finalizada".
- Se algum dos agentes sugerir um desses estágios, IGNORE e mantenha o stage atual do lead. Registre o motivo em reasons (ex.: "human_scheduling_lock").
- Datas (consulta_agendada_em, procedimento_agendado_em) NÃO devem aparecer em custom_fields_patch — são preenchidas exclusivamente pela secretária.

🚨 REGRA DA PRIMEIRA MENSAGEM:
- Se o Contexto trouxer \`PRIMEIRA_MENSAGEM_TEMPLATE: true\`, IGNORE qualquer "interesse_consulta", "interesse_tratamento" ou "scheduling_intent" sugerido pelos agentes — a única mensagem do lead é texto pré-fabricado de botão/anúncio. Mantenha o stage atual, zere intent (use "nenhum"/"none") e remova esses campos do custom_fields_patch. A ÚNICA chave aceita nesse cenário é "origem".
- "origem" tem lock humano permanente: se já existir valor preenchido nesse campo no lead, NÃO inclua no patch (o executor descarta).

Devolva todos os campos exigidos.`;
}

async function runMaestro(
  ai: ClassifierAi,
  summary: string,
  outAgendador: AgendadorOutput,
  outPreenchedor: TypifierOutput,
  outMovimentador: MovimentadorOutput,
  signals: Record<string, unknown>,
): Promise<{ output: MaestroOutput; usage?: unknown; fallbackUsed?: boolean }> {
  const modelId = pickModel(ai.provider, MAESTRO_SPEC);
  const system = buildMaestroSystem();
  const prompt = `RESUMO Factual:
${summary}

SIGNALS determinísticos do lead:
${JSON.stringify(signals, null, 2)}

OPINIÕES DOS AGENTES:
Agendador: ${JSON.stringify(outAgendador, null, 2)}
Preenchedor: ${JSON.stringify(outPreenchedor, null, 2)}
Movimentador: ${JSON.stringify(outMovimentador, null, 2)}

Emita o veredicto final resolvendo inconsistências.`;
  const result = await withJsonFallback<MaestroOutput>({
    label: "maestro",
    schema: MaestroOutputSchema,
    structured: () => withTimeout(
      generateText({
        model: ai.model(modelId),
        system,
        prompt,
        output: Output.object({ schema: MaestroOutputSchema }),
      }),
      TIMEOUT_MAESTRO_MS,
      "maestro",
    ),
    textFallback: () => withTimeout(
      generateText({
        model: ai.model(modelId),
        system: `${system}\nResponda somente JSON compacto, sem markdown. Campos: stage_suggestion string, intent string, mentioned_intents array, is_b2b boolean, confidence number entre 0 e 1, tags_suggested array, custom_fields_patch objeto, reasons array.`,
        prompt,
      }),
      TIMEOUT_MAESTRO_MS,
      "maestro:json_fallback",
    ),
  });
  return { output: result.output, usage: result.usage, fallbackUsed: result.fallbackUsed };
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

/** Padrões de erro que valem retentar com provider alternativo. */
const FALLBACK_PATTERN = /schema_retry_failed|No object generated|did not match schema|timeout after \d+ms|fetch failed|5\d\d/i;
/** Erros que indicam saldo/quota esgotado — não adianta retentar este provider por um tempo. */
const QUOTA_PATTERN = /quota|insufficient_quota|billing|payment required|402|exceeded your current/i;
const QUOTA_BLOCK_MIN = 30; // bloqueia 30min após hit

async function markProviderBlocked(
  client: SupabaseClient,
  clinicId: string,
  provider: "lovable" | "openai",
  err: string,
) {
  try {
    const until = new Date(Date.now() + QUOTA_BLOCK_MIN * 60_000).toISOString();
    await client
      .from("pipeline_provider_health")
      .upsert(
        { clinic_id: clinicId, provider, blocked_until: until, last_error: err.slice(0, 500), updated_at: new Date().toISOString() },
        { onConflict: "clinic_id,provider" },
      );
  } catch (e) {
    console.error("markProviderBlocked failed", e);
  }
}

async function isProviderBlocked(
  client: SupabaseClient,
  clinicId: string,
  provider: "lovable" | "openai",
): Promise<boolean> {
  const { data } = await client
    .from("pipeline_provider_health")
    .select("blocked_until")
    .eq("clinic_id", clinicId)
    .eq("provider", provider)
    .maybeSingle();
  if (!data?.blocked_until) return false;
  return new Date(data.blocked_until as string).getTime() > Date.now();
}

export async function runAgent(
  client: SupabaseClient,
  ctx: LeadContext,
  opts: { historyToolEnabled: boolean; onlyAgent?: AgentMode },
): Promise<RunAgentSuccess | { error: string }> {
  const primary = await getClassifierAi(client, ctx.lead.clinic_id);
  if (!primary) return { error: "no_ai_provider" };

  // Se o provider primário está bloqueado por quota, já vai direto pro alternativo (se disponível).
  let chosenPrimary = primary;
  if (await isProviderBlocked(client, ctx.lead.clinic_id, primary.provider)) {
    const altProv: "lovable" | "openai" = primary.provider === "lovable" ? "openai" : "lovable";
    if (!(await isProviderBlocked(client, ctx.lead.clinic_id, altProv))) {
      const alt = await getClassifierAi(client, ctx.lead.clinic_id, { forceProvider: altProv });
      if (alt && alt.provider !== primary.provider) {
        console.warn(JSON.stringify({ tag: "runAgent:primary_blocked", lead_id: ctx.lead.id, blocked: primary.provider, using: alt.provider }));
        chosenPrimary = alt;
      }
    }
  }

  const first = await runAgentOnce(client, ctx, opts, chosenPrimary);
  if (!("error" in first)) return first;

  if (QUOTA_PATTERN.test(first.error)) {
    await markProviderBlocked(client, ctx.lead.clinic_id, chosenPrimary.provider, first.error);
  }

  // P5-1: tenta UMA vez no provider alternativo se o erro for terminal
  // (schema/timeout/5xx) e houver chave do outro provider disponível.
  if (!FALLBACK_PATTERN.test(first.error) && !QUOTA_PATTERN.test(first.error)) return first;
  const altProvider: "lovable" | "openai" = chosenPrimary.provider === "lovable" ? "openai" : "lovable";
  if (await isProviderBlocked(client, ctx.lead.clinic_id, altProvider)) {
    console.warn(JSON.stringify({ tag: "runAgent:fallback_skipped_blocked", lead_id: ctx.lead.id, alt: altProvider }));
    return first;
  }
  const alt = await getClassifierAi(client, ctx.lead.clinic_id, { forceProvider: altProvider });
  if (!alt || alt.provider === chosenPrimary.provider) return first;

  console.warn(JSON.stringify({
    tag: "runAgent:provider_fallback",
    lead_id: ctx.lead.id,
    from: chosenPrimary.provider,
    to: alt.provider,
    reason: first.error.slice(0, 200),
  }));
  const second = await runAgentOnce(client, ctx, opts, alt);
  if ("error" in second) {
    if (QUOTA_PATTERN.test(second.error)) {
      await markProviderBlocked(client, ctx.lead.clinic_id, alt.provider, second.error);
    }
    return { error: `${second.error} (after_fallback_from_${chosenPrimary.provider})` };
  }
  return second;
}

async function runAgentOnce(
  client: SupabaseClient,
  ctx: LeadContext,
  _opts: { historyToolEnabled: boolean; onlyAgent?: AgentMode },
  ai: ClassifierAi,
): Promise<RunAgentSuccess | { error: string }> {

  // Resolve ids reais (provider-dependent) para usar nas chamadas e na telemetria.
  const M_SUMMARIZER   = pickModel(ai.provider, SUMMARIZER_SPEC);
  const M_AGENDADOR    = pickModel(ai.provider, AGENDADOR_SPEC);
  const M_TYPIFIER     = pickModel(ai.provider, TYPIFIER_SPEC);
  const M_MOVIMENTADOR = pickModel(ai.provider, MOVIMENTADOR_SPEC);
  const M_MAESTRO      = pickModel(ai.provider, MAESTRO_SPEC);

  console.log(JSON.stringify({
    tag: "runAgent:provider",
    rev: AGENT_CORE_REV,
    lead_id: ctx.lead.id,
    provider: ai.provider,
    summarizer: M_SUMMARIZER,
    maestro: M_MAESTRO,
  }));


  // ----- Passo 1 — Resumidor -----
  let summary: string;
  let summarizerModel = M_SUMMARIZER;
  let mentionedDates: SummarizerOutput["mentioned_dates"] = [];
  let usage1: unknown;
  const t1 = performance.now();

  try {
    const r1 = await runSummarizer(ai, ctx);
    summary = r1.output.summary;
    mentionedDates = r1.output.mentioned_dates ?? [];
    summarizerModel = r1.model;
    usage1 = r1.usage;
    await safeRecordStep({ ctx, model: summarizerModel.split(" ")[0], operation: "classifier:summarizer", status: "success", latencyMs: performance.now() - t1, usage: usage1, provider: ai.provider });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await safeRecordStep({ ctx, model: M_SUMMARIZER, operation: "classifier:summarizer", status: "error", latencyMs: performance.now() - t1, error: msg.slice(0, 500), provider: ai.provider, details: { phase: "summarizer" } });
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

  // Fase 13: Promise.allSettled — falha de 1 agente não derruba os outros 2.
  // Cada agente é registrado individualmente em ai_usage com seu status real.
  // Fallback de cada agente usa defaults seguros (Maestro corrige se houver sinal).
  const typifierTask: Promise<{ output: TypifierOutput; usage?: unknown; skipped: boolean }> = allKeysProtected
    ? Promise.resolve({
        output: { tags_suggested: [], custom_fields_patch: {}, reasons: ["skipped:all_keys_g10_protected"] } as TypifierOutput,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        skipped: true,
      })
    : runTypifier(ai, ctx, summary).then((r) => ({ ...r, skipped: false }));

  const [sAg, sPr, sMo] = await Promise.allSettled([
    runAgendador(ai, ctx, summary),
    typifierTask,
    runMovimentador(ai, ctx, summary),
  ]);
  const stepLat = performance.now() - t2;

  if (sAg.status === "fulfilled") {
    outAgendador = sAg.value.output;
    await safeRecordStep({ ctx, model: M_AGENDADOR, operation: "classifier:agendador", status: "success", latencyMs: stepLat, usage: sAg.value.usage, provider: ai.provider, details: { json_fallback_used: sAg.value.fallbackUsed === true } });
  } else {
    const msg = sAg.reason instanceof Error ? sAg.reason.message : String(sAg.reason);
    outAgendador = { is_scheduling_action: false, scheduling_intent: "nenhum", reasons: [`agendador_failed: ${msg.slice(0, 80)}`] };
    await safeRecordStep({ ctx, model: M_AGENDADOR, operation: "classifier:agendador", status: "error", latencyMs: stepLat, error: msg.slice(0, 500), provider: ai.provider, details: { phase: "parallel", fallback_used: true, fallback_output: "safe_default" } });
  }

  if (sPr.status === "fulfilled") {
    outPreenchedor = sPr.value.output;
    if (!sPr.value.skipped) {
      await safeRecordStep({ ctx, model: M_TYPIFIER, operation: "classifier:typifier", status: "success", latencyMs: stepLat, usage: sPr.value.usage, provider: ai.provider, details: { json_fallback_used: sPr.value.fallbackUsed === true } });
    }
  } else {
    const msg = sPr.reason instanceof Error ? sPr.reason.message : String(sPr.reason);
    outPreenchedor = { tags_suggested: [], custom_fields_patch: {}, reasons: [`typifier_failed: ${msg.slice(0, 80)}`] };
    await safeRecordStep({ ctx, model: M_TYPIFIER, operation: "classifier:typifier", status: "error", latencyMs: stepLat, error: msg.slice(0, 500), provider: ai.provider, details: { phase: "parallel", fallback_used: true, fallback_output: "safe_default" } });
  }

  if (sMo.status === "fulfilled") {
    outMovimentador = sMo.value.output;
    await safeRecordStep({ ctx, model: M_MOVIMENTADOR, operation: "classifier:movimentador", status: "success", latencyMs: stepLat, usage: sMo.value.usage, provider: ai.provider, details: { json_fallback_used: sMo.value.fallbackUsed === true } });
  } else {
    const msg = sMo.reason instanceof Error ? sMo.reason.message : String(sMo.reason);
    outMovimentador = { stage_suggestion: ctx.stageName, intent: "outro", mentioned_intents: [], is_b2b: false, reasons: [`movimentador_failed: ${msg.slice(0, 80)}`] };
    await safeRecordStep({ ctx, model: M_MOVIMENTADOR, operation: "classifier:movimentador", status: "error", latencyMs: stepLat, error: msg.slice(0, 500), provider: ai.provider, details: { phase: "parallel", fallback_used: true, fallback_output: "safe_default" } });
  }

  if (sAg.status === "rejected" && sPr.status === "rejected" && sMo.status === "rejected") {
    const reason = sMo.reason instanceof Error ? sMo.reason.message : String(sMo.reason);
    return { error: `agent_step2_parallel_failed: ${reason.slice(0, 200)}` };
  }

  usage2 = {
    ag: sAg.status === "fulfilled" ? sAg.value.usage : null,
    pr: sPr.status === "fulfilled" ? sPr.value.usage : null,
    mo: sMo.status === "fulfilled" ? sMo.value.usage : null,
    typifier_skipped: sPr.status === "fulfilled" ? sPr.value.skipped : false,
    parallel_failures: [
      sAg.status === "rejected" ? "agendador" : null,
      sPr.status === "rejected" ? "typifier" : null,
      sMo.status === "rejected" ? "movimentador" : null,
    ].filter(Boolean),
  };
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
    await safeRecordStep({ ctx, model: M_MAESTRO, operation: "classifier:maestro", status: "success", latencyMs: performance.now() - t3, usage: usage3, provider: ai.provider, details: { json_fallback_used: r3.fallbackUsed === true } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await safeRecordStep({ ctx, model: M_MAESTRO, operation: "classifier:maestro", status: "error", latencyMs: performance.now() - t3, error: msg.slice(0, 500), provider: ai.provider, details: { phase: "maestro", lead_requeued: true } });
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
      agendador_model: M_AGENDADOR,
      typifier_model: M_TYPIFIER,
      movimentador_model: M_MOVIMENTADOR,
      maestro_model: M_MAESTRO,
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

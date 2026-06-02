// ai-builder — Construtor de Agentes
// Actions:
//   - ping: smoke test de conectividade (Fase 1).
//   - interview_plan: gera 3-5 perguntas adaptadas a {niche, goal}, com 1 obrigatória de oferta dominante (Fase 3).
//   - generate_system_prompt: gera o system_prompt do agente final via LLM (Fase 3),
//     com cláusula de contexto do lead injetada/validada e adaptação multi-nicho.

import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";
import { chatCompletion, type Agent } from "../_shared/ai.ts";
import { buildBuilderSystemPrompt, LEAD_CONTEXT_CLAUSE } from "../_shared/builder-system-prompt.ts";

type Action =
  | "ping"
  | "interview_plan"
  | "generate_system_prompt"
  | "suggest_kb_urls"
  | "draft_knowledge_base"
  | "audit_kb";

interface Body {
  action: Action;
  clinic_id?: string;
  payload?: Record<string, unknown>;
  // Overrides usados pelo wizard /ai/agents/new para testar a conexão do agente
  // que está sendo criado (pode ser diferente do Builder da clínica).
  provider?: string;
  api_key?: string;
  base_url?: string | null;
  model?: string;
}

// ---------- helpers ----------

async function loadBuilder(clinic_id: string): Promise<Agent | null> {
  const supabase = sb();
  const { data } = await supabase
    .from("ai_agents")
    .select("*")
    .eq("clinic_id", clinic_id)
    .eq("system_key", "builder")
    .maybeSingle();
  return (data as Agent | null) ?? null;
}

function parseProviderError(err: unknown): { code: string; message: string; status: number } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes("401") || lower.includes("invalid api key") || lower.includes("incorrect api key") || lower.includes("unauthorized")) {
    return { code: "invalid_key", status: 401, message: "Chave de API inválida. Verifique se copiou a chave completa do seu provedor." };
  }
  if (lower.includes("insufficient_quota") || lower.includes("402") || lower.includes("payment required") || lower.includes("billing")) {
    return { code: "no_credit", status: 402, message: "Sua conta no provedor está sem crédito. Adicione saldo e tente de novo." };
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return { code: "rate_limit", status: 429, message: "Limite de requisições do provedor. Tente novamente em alguns segundos." };
  }
  if (lower.includes("model") && (lower.includes("not found") || lower.includes("does not exist") || lower.includes("unknown"))) {
    return { code: "model_not_found", status: 400, message: "Modelo configurado não foi encontrado no provedor. Escolha outro modelo." };
  }
  if (lower.includes("timeout") || lower.includes("network")) {
    return { code: "network", status: 503, message: "Não consegui falar com o provedor. Cheque sua conexão ou a Base URL." };
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504")) {
    return { code: "provider_down", status: 503, message: "Provedor instável no momento. Tente novamente em alguns instantes." };
  }
  return { code: "unknown", status: 500, message: `Erro ao falar com o provedor: ${raw.slice(0, 240)}` };
}

function extractToolArguments(resp: { choices?: any[] }, name: string): any | null {
  const tc = resp?.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) return null;
  if (tc.function?.name && tc.function.name !== name) return null;
  try {
    return JSON.parse(tc.function?.arguments ?? "{}");
  } catch {
    return null;
  }
}

// ---------- niche dictionary (para enriquecer o pedido ao Builder) ----------

const NICHE_LABEL: Record<string, string> = {
  clinic: "Clínica / Saúde",
  real_estate: "Imobiliária",
  restaurant: "Restaurante / Food",
  ecommerce: "E-commerce",
  saas: "SaaS / Software B2B",
  law: "Advocacia",
  education: "Educação",
  aesthetics: "Estética / Beleza",
  dental: "Odontologia",
  agency: "Agência / Serviços B2B",
  local_services: "Serviços locais",
  other: "Outro",
};

const DOMINANT_OFFER_HINT: Record<string, string> = {
  clinic: "Qual profissional ou especialidade é o principal carro-chefe?",
  dental: "Qual especialidade odontológica é a principal?",
  real_estate: "Locação, venda ou ambos? Bairros prioritários?",
  restaurant: "Capacidade média do salão e horários de pico?",
  ecommerce: "Qual categoria ou produto carro-chefe?",
  saas: "Plano de entrada e perfil ideal do cliente (ICP)?",
  law: "Área de atuação principal?",
  education: "Curso ou turma com mais demanda?",
  aesthetics: "Procedimento mais procurado?",
  agency: "Serviço de entrada que você mais vende?",
  local_services: "Serviço mais pedido + região de atendimento?",
  other: "Qual é a oferta principal que você mais vende?",
};

const GOAL_LABEL: Record<string, string> = {
  sdr: "Qualificar e agendar (SDR)",
  classifier: "Classificar conversas",
  support: "Suporte / dúvidas",
  scheduler: "Agendador",
  custom: "Fluxo customizado",
};

// ---------- ping ----------

async function actionPing(builder: Agent, persistVerified: boolean) {
  if (!builder.api_key) {
    return { ok: false, code: "missing_key", message: "Adicione uma chave de API ao Construtor antes de testar." };
  }
  const started = Date.now();
  try {
    const resp = await chatCompletion(
      builder,
      [
        { role: "system", content: "Responda apenas 'ok'." },
        { role: "user", content: "ping" },
      ],
      undefined,
      { agent_id: builder.id, note: "ai-builder:ping" },
    );
    if (!resp.ok) throw new Error(resp.errorText || `provider ${resp.status}`);

    const latency_ms = Date.now() - started;
    const text = resp?.choices?.[0]?.message?.content ?? "";

    if (persistVerified) {
      const supabase = sb();
      await supabase
        .from("ai_agents")
        .update({ builder_verified_at: new Date().toISOString() })
        .eq("id", builder.id);
    }

    return { ok: true, latency_ms, model: builder.model, provider: builder.provider, sample: text.slice(0, 64) };
  } catch (e) {
    const parsed = parseProviderError(e);
    return { ok: false, ...parsed };
  }
}

// ---------- interview_plan ----------

const INTERVIEW_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_interview_plan",
    description: "Devolve 3 a 5 perguntas curtas que o Construtor fará ao usuário para configurar o agente. EXATAMENTE 1 pergunta com kind='dominant_offer' é obrigatória.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "slug curto, sem espaços (ex: 'dominant_offer', 'tone', 'taboo')" },
              label: { type: "string", description: "Pergunta direta em PT-BR, adaptada ao nicho. Sem jargão." },
              hint: { type: "string", description: "Frase de apoio curta (opcional)." },
              placeholder: { type: "string", description: "Exemplo de resposta esperado (opcional)." },
              kind: { type: "string", enum: ["dominant_offer", "tone", "taboo", "qualification", "escalation", "context", "custom"] },
              required: { type: "boolean" },
            },
            required: ["id", "label", "kind", "required"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
  },
};

async function actionInterviewPlan(builder: Agent, payload: Record<string, unknown>) {
  const niche = String(payload.niche ?? "other");
  const nicheOther = String(payload.niche_other ?? "");
  const goal = String(payload.goal ?? "sdr");
  const goalOther = String(payload.goal_other ?? "");

  const nicheName = niche === "other" && nicheOther ? nicheOther : (NICHE_LABEL[niche] ?? niche);
  const goalName = goal === "custom" && goalOther ? goalOther : (GOAL_LABEL[goal] ?? goal);
  const dominantHint = DOMINANT_OFFER_HINT[niche] ?? DOMINANT_OFFER_HINT.other;

  const system = await buildBuilderSystemPrompt();
  const userPrompt = `\
Gere o plano de entrevista para um agente NOVO.

Nicho: ${nicheName}
Objetivo do agente: ${goalName}

Regras:
- 3 a 5 perguntas no total.
- EXATAMENTE 1 pergunta com kind="dominant_offer" e required=true. Use como base: "${dominantHint}" — adapte ao nicho/objetivo se fizer sentido.
- As outras perguntas devem cobrir tom, tabu (o que não falar), critério de qualificação ou regra de escalação — escolha as 2-4 mais úteis para esse objetivo. Evite redundância.
- Linguagem neutra ao nicho. NÃO assuma clínica a menos que seja explicitamente clínica/odonto.
- Perguntas devem ser curtas, diretas, respondíveis em uma frase.

Chame a tool submit_interview_plan com o resultado.`;

  try {
    const resp = await chatCompletion(
      builder,
      [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      [INTERVIEW_TOOL],
      { agent_id: builder.id, note: "ai-builder:interview_plan" },
    );
    if (!resp.ok) throw new Error(resp.errorText || `provider ${resp.status}`);

    const args = extractToolArguments(resp, "submit_interview_plan");
    if (!args?.questions || !Array.isArray(args.questions)) {
      return { ok: false, code: "unknown", message: "O Construtor não devolveu perguntas. Tente novamente." };
    }
    // garantir 1 dominant_offer
    const hasDominant = args.questions.some((q: any) => q.kind === "dominant_offer");
    if (!hasDominant) {
      args.questions.unshift({
        id: "dominant_offer",
        label: dominantHint,
        kind: "dominant_offer",
        required: true,
      });
    }
    return { ok: true, questions: args.questions.slice(0, 5) };
  } catch (e) {
    const parsed = parseProviderError(e);
    return { ok: false, ...parsed };
  }
}

// ---------- generate_system_prompt ----------

const PROMPT_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_agent_prompt",
    description: "Devolve o system_prompt completo do agente final + sugestões de tools e parâmetros.",
    parameters: {
      type: "object",
      properties: {
        system_prompt: {
          type: "string",
          description: "Prompt completo em PT-BR, no estilo Markdown leve. DEVE conter a cláusula literal de uso do contexto do lead fornecida pelo Construtor. Use a oferta dominante como caminho default.",
        },
        suggested_tools: {
          type: "array",
          items: { type: "string" },
          description: "Lista de tool ids do CRM relevantes (ex: 'move_lead_stage', 'set_lead_field', 'schedule_message', 'transfer_to_human', 'search_knowledge_base', 'add_lead_note').",
        },
        suggested_temperature: { type: "number", minimum: 0, maximum: 1 },
        suggested_top_k: { type: "integer", minimum: 1, maximum: 20 },
        suggested_max_iterations: { type: "integer", minimum: 1, maximum: 12 },
        rationale: { type: "string", description: "Justificativa curta das escolhas (2-4 frases)." },
      },
      required: [
        "system_prompt",
        "suggested_tools",
        "suggested_temperature",
        "suggested_top_k",
        "suggested_max_iterations",
        "rationale",
      ],
      additionalProperties: false,
    },
  },
};

interface PromptResult {
  system_prompt: string;
  suggested_tools: string[];
  suggested_temperature: number;
  suggested_top_k: number;
  suggested_max_iterations: number;
  rationale: string;
}

function ensureContextClause(prompt: string): string {
  // Eval automático da Cláusula A: se faltar, injeta logo após o título.
  const needle = "Use o contexto do lead antes de perguntar";
  if (prompt.includes(needle)) return prompt;
  const lines = prompt.split("\n");
  const insertAt = lines.findIndex((l) => l.trim().length > 0) + 1;
  lines.splice(insertAt, 0, "", LEAD_CONTEXT_CLAUSE, "");
  return lines.join("\n");
}

async function actionGenerateSystemPrompt(builder: Agent, payload: Record<string, unknown>) {
  const niche = String(payload.niche ?? "other");
  const nicheOther = String(payload.niche_other ?? "");
  const goal = String(payload.goal ?? "sdr");
  const goalOther = String(payload.goal_other ?? "");
  const answers = (payload.answers ?? {}) as Record<string, string>;
  const refinement = String(payload.refinement ?? "");
  const previousPrompt = String(payload.previous_prompt ?? "");

  const nicheName = niche === "other" && nicheOther ? nicheOther : (NICHE_LABEL[niche] ?? niche);
  const goalName = goal === "custom" && goalOther ? goalOther : (GOAL_LABEL[goal] ?? goal);

  const answersBlock = Object.keys(answers).length
    ? Object.entries(answers)
        .map(([k, v]) => `- ${k}: ${String(v).trim() || "(não informado)"}`)
        .join("\n")
    : "(nenhuma resposta — use defaults sensatos por nicho)";

  const refinementBlock = refinement
    ? `\n\nO usuário pediu este REFINAMENTO sobre o prompt anterior. Aplique mantendo o resto bom:\n${refinement}\n\nPrompt anterior:\n---\n${previousPrompt}\n---`
    : "";

  const system = await buildBuilderSystemPrompt();
  const userPrompt = `\
Gere o system_prompt FINAL do agente.

Nicho: ${nicheName}
Objetivo: ${goalName}

Respostas da entrevista:
${answersBlock}

Diretrizes do prompt:
1. PT-BR, frases curtas, sem floreios.
2. INCLUA LITERALMENTE este bloco de cláusula de contexto do lead (sem reescrever):
---
${LEAD_CONTEXT_CLAUSE}
---
3. Use a resposta da pergunta de oferta dominante como CAMINHO DEFAULT do agente. Outras ofertas viram fallback se o lead recusar.
4. Linguagem neutra ao nicho. NÃO use "paciente/clínica/Dr." se o nicho não for saúde.
5. Estruture com seções: Identidade, Objetivo, Como conduzir a conversa, Caminho default, Fallbacks, Tom, Tabu, Quando escalar.
6. Recomende temperature entre 0.2-0.6 (mais baixo para classificadores/agendadores, mais alto para SDR/suporte).
7. Sugira tools coerentes com o objetivo.${refinementBlock}

Chame a tool submit_agent_prompt com o resultado.`;

  try {
    const resp = await chatCompletion(
      builder,
      [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      [PROMPT_TOOL],
      { agent_id: builder.id, note: "ai-builder:generate_system_prompt" },
    );
    if (!resp.ok) throw new Error(resp.errorText || `provider ${resp.status}`);

    const args = extractToolArguments(resp, "submit_agent_prompt") as PromptResult | null;
    if (!args?.system_prompt) {
      return { ok: false, code: "unknown", message: "O Construtor não devolveu um prompt válido. Tente novamente." };
    }

    const finalPrompt = ensureContextClause(args.system_prompt);
    const eval_passed = finalPrompt.includes("Use o contexto do lead antes de perguntar");

    return {
      ok: true,
      system_prompt: finalPrompt,
      suggested_tools: Array.isArray(args.suggested_tools) ? args.suggested_tools : [],
      suggested_temperature: Number(args.suggested_temperature ?? 0.4),
      suggested_top_k: Number(args.suggested_top_k ?? 6),
      suggested_max_iterations: Number(args.suggested_max_iterations ?? 6),
      rationale: args.rationale ?? "",
      evals: { context_clause_present: eval_passed },
    };
  } catch (e) {
    const parsed = parseProviderError(e);
    return { ok: false, ...parsed };
  }
}

// ---------- handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  if (!body.action) return json({ error: "action é obrigatório" }, 400);
  if (!body.clinic_id) return json({ error: "clinic_id é obrigatório" }, 400);

  const builder = await loadBuilder(body.clinic_id);
  if (!builder) {
    return json({ error: "Construtor não provisionado para esta clínica." }, 404);
  }

  try {
    switch (body.action) {
      case "ping": {
        const hasOverride = !!(body.api_key && body.provider && body.model);
        const target: Agent = hasOverride
          ? {
              ...builder,
              provider: body.provider as Agent["provider"],
              api_key: body.api_key!,
              base_url: body.base_url ?? null,
              model: body.model!,
            }
          : builder;
        const result = await actionPing(target, !hasOverride);
        return json(result, result.ok ? 200 : (result as { status?: number }).status ?? 400);
      }
      case "interview_plan": {
        if (!builder.api_key) {
          return json({ error: "Configure a chave de API do Construtor antes de gerar perguntas." }, 400);
        }
        const result = await actionInterviewPlan(builder, body.payload ?? {});
        return json(result, result.ok ? 200 : (result as { status?: number }).status ?? 400);
      }
      case "generate_system_prompt": {
        if (!builder.api_key) {
          return json({ error: "Configure a chave de API do Construtor antes de gerar prompts." }, 400);
        }
        const result = await actionGenerateSystemPrompt(builder, body.payload ?? {});
        return json(result, result.ok ? 200 : (result as { status?: number }).status ?? 400);
      }
      default:
        return json({ error: `action desconhecida: ${body.action}` }, 400);
    }
  } catch (e) {
    console.error("ai-builder error:", e);
    const parsed = parseProviderError(e);
    return json({ ok: false, ...parsed }, parsed.status);
  }
});

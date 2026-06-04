// ai-builder — Construtor de Agentes
// Actions:
//   - ping: smoke test de conectividade (Fase 1).
//   - interview_plan: gera 3-5 perguntas adaptadas a {niche, goal}, com 1 obrigatória de oferta dominante (Fase 3).
//   - generate_system_prompt: gera o system_prompt do agente final via LLM (Fase 3),
//     com cláusula de contexto do lead injetada/validada e adaptação multi-nicho.

import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";
import { chatCompletion, type Agent } from "../_shared/ai.ts";
import { buildBuilderSystemPrompt, LEAD_CONTEXT_CLAUSE } from "../_shared/builder-system-prompt.ts";
import { nicheKbBlock } from "../_shared/builder-knowledge/niche-loader.ts";

type Action =
  | "ping"
  | "interview_plan"
  | "generate_system_prompt"
  | "suggest_kb_urls"
  | "draft_knowledge_base"
  | "audit_kb"
  | "generate_scenarios"
  | "run_evaluation"
  | "generate_insights"
  | "copilot_chat";

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

// ---------- Phase 4: KB assistant ----------

const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|0\.0\.0\.0$)/i;

function validateHttpUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (PRIVATE_HOST_RE.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

async function fetchHtml(url: URL, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LovableBuilder/1.0)" },
    });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(tid);
  }
}

function extractLinks(html: string, base: URL): Array<{ url: string; text: string }> {
  const out: Array<{ url: string; text: string }> = [];
  const seen = new Set<string>();
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const rawHref = m[1].trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("javascript:")) continue;
    let abs: URL;
    try { abs = new URL(rawHref, base); } catch { continue; }
    if (abs.hostname !== base.hostname) continue;
    if (!/^https?:$/.test(abs.protocol)) continue;
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|rar|mp4|mp3|css|js|ico|woff2?)(\?.*)?$/i.test(abs.pathname)) continue;
    abs.hash = "";
    const key = abs.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    out.push({ url: key, text });
    if (out.length >= 80) break;
  }
  return out;
}

const SUGGEST_URLS_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_kb_url_suggestions",
    description: "Recomenda quais URLs do site valem ser ingeridas na base de conhecimento do agente, em ordem de utilidade.",
    parameters: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          minItems: 1,
          maxItems: 15,
          items: {
            type: "object",
            properties: {
              url: { type: "string" },
              title: { type: "string", description: "Título sugerido para o documento (PT-BR, curto)." },
              reason: { type: "string", description: "Por que esta URL é útil para o agente (1 frase, PT-BR)." },
              recommended: { type: "boolean", description: "true se deve vir marcada por padrão." },
            },
            required: ["url", "title", "reason", "recommended"],
            additionalProperties: false,
          },
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
  },
};

async function actionSuggestKbUrls(builder: Agent, payload: Record<string, unknown>) {
  const rawUrl = String(payload.url ?? "").trim();
  const v = validateHttpUrl(rawUrl);
  if (!v) return { ok: false, code: "invalid_url", status: 400, message: "URL inválida ou bloqueada." };

  const niche = String(payload.niche ?? "other");
  const goal = String(payload.goal ?? "sdr");
  const dominantOffer = String(payload.dominant_offer ?? "").trim();
  const nicheName = NICHE_LABEL[niche] ?? niche;
  const goalName = GOAL_LABEL[goal] ?? goal;

  let html = "";
  try {
    html = await fetchHtml(v);
  } catch (e) {
    return { ok: false, code: "fetch_failed", status: 502, message: `Não consegui acessar o site: ${(e as Error).message}` };
  }
  const links = extractLinks(html, v);
  if (links.length === 0) {
    return { ok: false, code: "no_links", status: 200, message: "Não encontrei links navegáveis nessa página. Tente a home do site." };
  }

  const linksBlock = links.map((l, i) => `${i + 1}. ${l.url}${l.text ? `  — "${l.text}"` : ""}`).join("\n");
  const system = await buildBuilderSystemPrompt();
  const userPrompt = `\
Você está montando a base de conhecimento de um agente de IA.

Site: ${v.origin}
Nicho: ${nicheName}
Objetivo do agente: ${goalName}
${dominantOffer ? `Oferta principal: ${dominantOffer}` : ""}

Abaixo estão links encontrados na página inicial. Selecione APENAS os mais úteis para o agente responder leads (páginas de serviços/produtos, preços, FAQ, sobre, processo, contato/agendamento). IGNORE: blog antigo, posts soltos, política/privacidade/termos, login, carrinho, paginação, tags, categorias vazias.

Devolva no MÁXIMO 15. Marque recommended=true só nas 3-6 mais importantes.

Links:
${linksBlock}

Chame submit_kb_url_suggestions.`;

  try {
    const resp = await chatCompletion(
      builder,
      [{ role: "system", content: system }, { role: "user", content: userPrompt }],
      [SUGGEST_URLS_TOOL],
      { agent_id: builder.id, note: "ai-builder:suggest_kb_urls" },
    );
    if (!resp.ok) throw new Error(resp.errorText || `provider ${resp.status}`);
    const args = extractToolArguments(resp, "submit_kb_url_suggestions");
    if (!args?.suggestions?.length) {
      return { ok: false, code: "unknown", message: "O Construtor não devolveu sugestões. Tente novamente." };
    }
    // sanity: keep only same-host suggestions
    const filtered = (args.suggestions as any[])
      .filter((s) => {
        try { return new URL(s.url).hostname === v.hostname; } catch { return false; }
      })
      .slice(0, 15);
    return { ok: true, base_url: v.origin, found: links.length, suggestions: filtered };
  } catch (e) {
    const parsed = parseProviderError(e);
    return { ok: false, ...parsed };
  }
}

const DRAFT_KB_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_kb_draft",
    description: "Transforma um texto bruto em um documento de base de conhecimento limpo e estruturado.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título curto em PT-BR (até 80 chars)." },
        content: { type: "string", description: "Conteúdo em Markdown leve, com seções (##) e bullets quando fizer sentido. Sem floreios, sem repetições." },
        summary: { type: "string", description: "Resumo de 1-2 frases do que o documento cobre." },
      },
      required: ["title", "content", "summary"],
      additionalProperties: false,
    },
  },
};

async function actionDraftKnowledgeBase(builder: Agent, payload: Record<string, unknown>) {
  const raw = String(payload.text ?? "").trim();
  if (raw.length < 30) return { ok: false, code: "too_short", status: 400, message: "Cole um texto com pelo menos algumas linhas." };
  if (raw.length > 80_000) return { ok: false, code: "too_long", status: 400, message: "Texto muito longo. Divida em partes menores." };

  const titleHint = String(payload.title_hint ?? "").trim();
  const niche = String(payload.niche ?? "other");
  const goal = String(payload.goal ?? "sdr");
  const nicheName = NICHE_LABEL[niche] ?? niche;
  const goalName = GOAL_LABEL[goal] ?? goal;

  const system = await buildBuilderSystemPrompt();
  const userPrompt = `\
Limpe e estruture o texto abaixo para virar UM documento da base de conhecimento de um agente de IA.

Nicho: ${nicheName}
Objetivo do agente: ${goalName}
${titleHint ? `Sugestão de título do usuário: ${titleHint}` : ""}

Regras:
- PT-BR, frases curtas, sem floreios de marketing.
- Remova navegação, menus, cookies, repetições, "leia mais", botões.
- Agrupe em seções com ## quando fizer sentido (Serviços, Preços, FAQ, Horários, etc).
- Mantenha fatos úteis para responder leads (o que oferece, como funciona, valores, prazos, contatos, diferenciais).
- NÃO invente informação que não esteja no texto.

Texto bruto:
---
${raw}
---

Chame submit_kb_draft.`;

  try {
    const resp = await chatCompletion(
      builder,
      [{ role: "system", content: system }, { role: "user", content: userPrompt }],
      [DRAFT_KB_TOOL],
      { agent_id: builder.id, note: "ai-builder:draft_knowledge_base" },
    );
    if (!resp.ok) throw new Error(resp.errorText || `provider ${resp.status}`);
    const args = extractToolArguments(resp, "submit_kb_draft");
    if (!args?.title || !args?.content) {
      return { ok: false, code: "unknown", message: "O Construtor não devolveu um documento válido. Tente novamente." };
    }
    return {
      ok: true,
      title: String(args.title).slice(0, 120),
      content: String(args.content),
      summary: String(args.summary ?? ""),
    };
  } catch (e) {
    const parsed = parseProviderError(e);
    return { ok: false, ...parsed };
  }
}

const AUDIT_KB_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_kb_audit",
    description: "Aponta lacunas na base de conhecimento do agente, adaptado ao nicho e à oferta principal.",
    parameters: {
      type: "object",
      properties: {
        overall: { type: "string", enum: ["solid", "ok", "weak"], description: "Avaliação geral da base." },
        coverage_note: { type: "string", description: "1-2 frases resumindo o que está coberto e o que falta." },
        gaps: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              topic: { type: "string", description: "Tópico ausente ou fraco (PT-BR, curto)." },
              why: { type: "string", description: "Por que esse tópico importa para esse agente (1 frase)." },
              severity: { type: "string", enum: ["high", "medium", "low"] },
              suggestion: { type: "string", description: "Como o usuário pode preencher (ex: 'cole o texto da página X', 'descreva seu processo de agendamento')." },
            },
            required: ["topic", "why", "severity", "suggestion"],
            additionalProperties: false,
          },
        },
      },
      required: ["overall", "coverage_note", "gaps"],
      additionalProperties: false,
    },
  },
};

async function actionAuditKb(builder: Agent, payload: Record<string, unknown>) {
  const agentId = String(payload.agent_id ?? "").trim();
  if (!agentId) return { ok: false, code: "missing_agent", status: 400, message: "agent_id obrigatório." };

  const supabase = sb();
  const { data: docs } = await supabase
    .from("ai_documents")
    .select("id, title, source, source_type, content")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(80);

  const docsList = (docs ?? []).map((d: any) => {
    const snippet = String(d.content ?? "").replace(/\s+/g, " ").slice(0, 240);
    return `- [${d.source_type === "system_default" ? "padrão" : "user"}] ${d.title}${snippet ? ` — ${snippet}…` : ""}`;
  }).join("\n") || "(base vazia)";

  const niche = String(payload.niche ?? "other");
  const goal = String(payload.goal ?? "sdr");
  const dominantOffer = String(payload.dominant_offer ?? "").trim();
  const nicheName = NICHE_LABEL[niche] ?? niche;
  const goalName = GOAL_LABEL[goal] ?? goal;

  const system = await buildBuilderSystemPrompt();
  const userPrompt = `\
Audite a base de conhecimento abaixo e aponte LACUNAS específicas e acionáveis para esse agente.

Nicho: ${nicheName}
Objetivo: ${goalName}
${dominantOffer ? `Oferta principal: ${dominantOffer}` : ""}

Documentos atuais:
${docsList}

Regras:
- Aponte no máximo 8 lacunas, ordenadas por severidade (high → low).
- Se o agente é SDR/Agendador e não há nada sobre a oferta principal, isso é high.
- Considere coberto o que já está em documentos "padrão" — só aponte se mesmo assim falta algo específico do negócio.
- NÃO invente que algo falta se já está nos snippets.
- Linguagem neutra ao nicho.

Chame submit_kb_audit.`;

  try {
    const resp = await chatCompletion(
      builder,
      [{ role: "system", content: system }, { role: "user", content: userPrompt }],
      [AUDIT_KB_TOOL],
      { agent_id: builder.id, note: "ai-builder:audit_kb" },
    );
    if (!resp.ok) throw new Error(resp.errorText || `provider ${resp.status}`);
    const args = extractToolArguments(resp, "submit_kb_audit");
    if (!args) return { ok: false, code: "unknown", message: "O Construtor não devolveu uma auditoria. Tente novamente." };
    return {
      ok: true,
      overall: args.overall ?? "ok",
      coverage_note: args.coverage_note ?? "",
      gaps: Array.isArray(args.gaps) ? args.gaps.slice(0, 8) : [],
      docs_count: docs?.length ?? 0,
    };
  } catch (e) {
    const parsed = parseProviderError(e);
    return { ok: false, ...parsed };
  }
}

// ---------- Phase 5: Test Lab — scenarios + evaluation ----------

const SCENARIOS_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_scenarios",
    description: "Gera 3-5 cenários de teste realistas para o agente, adaptados ao nicho e à oferta principal.",
    parameters: {
      type: "object",
      properties: {
        scenarios: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "slug curto (ex: 'lead_quente', 'objecao_preco')." },
              name: { type: "string", description: "Nome curto do cenário (PT-BR)." },
              persona: { type: "string", description: "Quem é o lead simulado (1-2 frases)." },
              opening_message: { type: "string", description: "Primeira mensagem que o lead enviaria, no tom dele." },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
              expected_outcomes: {
                type: "array",
                items: { type: "string" },
                description: "O que o agente DEVE fazer para passar (3-5 critérios objetivos).",
              },
            },
            required: ["id", "name", "persona", "opening_message", "difficulty", "expected_outcomes"],
            additionalProperties: false,
          },
        },
      },
      required: ["scenarios"],
      additionalProperties: false,
    },
  },
};

async function actionGenerateScenarios(builder: Agent, payload: Record<string, unknown>) {
  const agentId = String(payload.agent_id ?? "");
  if (!agentId) return { ok: false, code: "missing_agent", status: 400, message: "agent_id obrigatório." };

  const supabase = sb();
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("name, system_prompt, tools")
    .eq("id", agentId)
    .single();
  if (!agent) return { ok: false, code: "not_found", status: 404, message: "Agente não encontrado." };

  const niche = String(payload.niche ?? "other");
  const goal = String(payload.goal ?? "sdr");
  const dominantOffer = String(payload.dominant_offer ?? "").trim();
  const nicheName = NICHE_LABEL[niche] ?? niche;
  const goalName = GOAL_LABEL[goal] ?? goal;

  const system = await buildBuilderSystemPrompt();
  const userPrompt = `\
Gere 3-5 cenários de teste para o agente abaixo. Cada cenário simula um lead REAL chegando.

Agente: ${agent.name}
Nicho: ${nicheName}
Objetivo: ${goalName}
${dominantOffer ? `Oferta principal: ${dominantOffer}` : ""}

Prompt do agente (resumido):
${String(agent.system_prompt ?? "").slice(0, 1500)}

Regras:
- Misture dificuldades: 1 fácil (lead quente direto), 1-2 médios (precisa qualificar/responder dúvida), 1 difícil (objeção forte, lead ambíguo, ou pedido fora do escopo que exige escalar).
- opening_message no TOM do lead (informal, com erros se for o caso), não no tom do agente.
- expected_outcomes objetivos e verificáveis (ex: "perguntou o nome só se não estava no contexto", "ofereceu o serviço default antes de listar tudo").
- Linguagem neutra ao nicho. NÃO use termos de saúde se não for clínica/odonto.

Chame submit_scenarios.`;

  try {
    const resp = await chatCompletion(
      builder,
      [{ role: "system", content: system }, { role: "user", content: userPrompt }],
      [SCENARIOS_TOOL],
      { agent_id: builder.id, note: "ai-builder:generate_scenarios" },
    );
    if (!resp.ok) throw new Error(resp.errorText || `provider ${resp.status}`);
    const args = extractToolArguments(resp, "submit_scenarios");
    if (!args?.scenarios?.length) {
      return { ok: false, code: "unknown", message: "O Construtor não devolveu cenários. Tente novamente." };
    }
    return { ok: true, scenarios: args.scenarios.slice(0, 5) };
  } catch (e) {
    const parsed = parseProviderError(e);
    return { ok: false, ...parsed };
  }
}

const EVAL_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_evaluation",
    description: "Avalia o desempenho do agente após uma simulação multi-turn.",
    parameters: {
      type: "object",
      properties: {
        overall_score: { type: "number", minimum: 0, maximum: 5, description: "Nota geral 0-5." },
        passed: { type: "boolean", description: "true se o agente cumpriu o cenário aceitavelmente." },
        scores: {
          type: "object",
          properties: {
            uso_contexto: { type: "number", minimum: 0, maximum: 5, description: "Usou nome/campos/histórico antes de perguntar?" },
            adesao_oferta: { type: "number", minimum: 0, maximum: 5, description: "Direcionou para a oferta principal antes de listar tudo?" },
            tom: { type: "number", minimum: 0, maximum: 5, description: "Tom adequado ao nicho e ao lead?" },
            escalacao: { type: "number", minimum: 0, maximum: 5, description: "Escalou para humano nos gatilhos certos (ou conduziu até o fim sem precisar)?" },
          },
          required: ["uso_contexto", "adesao_oferta", "tom", "escalacao"],
          additionalProperties: false,
        },
        strengths: { type: "array", items: { type: "string" }, description: "2-3 acertos concretos." },
        weaknesses: { type: "array", items: { type: "string" }, description: "2-4 problemas concretos com citação curta." },
        suggested_patch: { type: "string", description: "Bloco curto em PT-BR para ANEXAR ao system_prompt e corrigir os principais defeitos. Pode ser vazio se nada a melhorar." },
      },
      required: ["overall_score", "passed", "scores", "strengths", "weaknesses", "suggested_patch"],
      additionalProperties: false,
    },
  },
};

async function actionRunEvaluation(builder: Agent, payload: Record<string, unknown>) {
  const agentId = String(payload.agent_id ?? "");
  if (!agentId) return { ok: false, code: "missing_agent", status: 400, message: "agent_id obrigatório." };

  const scenario = payload.scenario as {
    id?: string;
    name?: string;
    persona?: string;
    opening_message?: string;
    expected_outcomes?: string[];
  } | undefined;
  if (!scenario?.opening_message) {
    return { ok: false, code: "missing_scenario", status: 400, message: "scenario.opening_message obrigatório." };
  }

  const turnsMax = Math.max(2, Math.min(8, Number(payload.max_turns ?? 5)));

  const supabase = sb();
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("name, system_prompt")
    .eq("id", agentId)
    .single();
  if (!agent) return { ok: false, code: "not_found", status: 404, message: "Agente não encontrado." };

  // Builder simula o lead em N turnos
  const transcript: Array<{ role: "lead" | "agent"; content: string }> = [
    { role: "lead", content: scenario.opening_message },
  ];

  const builderSystem = `Você é um lead simulado em um teste de agente de IA.
Persona: ${scenario.persona ?? "lead típico"}
Cenário: ${scenario.name ?? "teste"}
Regras:
- Responda SEMPRE em PT-BR, no tom do lead (informal, curto, pode ter erro de digitação).
- Não saia do papel. Não revele que é simulação.
- Responda só à última mensagem do agente, em 1-3 frases.
- Se o agente resolver bem (agendar, qualificar ou escalar corretamente), aceite e encerre com algo como "ok, valeu".
- Se o agente errar/perguntar coisa óbvia, demonstre frustração de forma realista.`;

  try {
    for (let turn = 0; turn < turnsMax; turn++) {
      // 1) agente responde
      const agentMessages = [
        { role: "system", content: String(agent.system_prompt ?? "") },
        ...transcript.map((m) => ({
          role: m.role === "lead" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
      ];
      const resAgent = await supabase.functions.invoke("ai-chat", {
        body: { agent_id: agentId, messages: agentMessages.slice(1) },
      });
      const agentText = (resAgent.data as any)?.content ?? "";
      if (!agentText) break;
      transcript.push({ role: "agent", content: agentText });

      // 2) builder simula resposta do lead
      const builderMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: builderSystem },
        ...transcript.map((m) => ({
          role: m.role === "lead" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
      ];
      const resBuilder = await chatCompletion(builder, builderMessages, undefined, {
        agent_id: builder.id,
        note: "ai-builder:simulate_lead",
      });
      if (!resBuilder.ok) break;
      const leadText = resBuilder.choices?.[0]?.message?.content?.trim() ?? "";
      if (!leadText) break;
      transcript.push({ role: "lead", content: leadText });

      // encerra se lead aceitou
      if (/\b(ok,?\s*valeu|fechou|combinado|perfeito,?\s*at[ée]\s*l[áa]|pode\s*marcar)\b/i.test(leadText)) {
        break;
      }
    }

    // 3) avaliação final
    const transcriptText = transcript
      .map((m, i) => `${i + 1}. ${m.role === "lead" ? "LEAD" : "AGENTE"}: ${m.content}`)
      .join("\n");
    const criteria = (scenario.expected_outcomes ?? []).map((c) => `- ${c}`).join("\n") || "(sem critérios)";

    const evalUser = `\
Avalie o desempenho do AGENTE na simulação abaixo.

Cenário: ${scenario.name ?? ""}
Persona do lead: ${scenario.persona ?? ""}

Critérios esperados:
${criteria}

Transcrição:
${transcriptText}

Atribua notas 0-5 nas 4 dimensões. Seja rigoroso mas justo. Se o agente perguntou algo que estava no contexto, baixe uso_contexto. Se ofereceu o catálogo todo em vez da oferta principal, baixe adesao_oferta. suggested_patch só com o estritamente necessário para corrigir o pior defeito.

Chame submit_evaluation.`;

    const resp = await chatCompletion(
      builder,
      [
        { role: "system", content: await buildBuilderSystemPrompt() },
        { role: "user", content: evalUser },
      ],
      [EVAL_TOOL],
      { agent_id: builder.id, note: "ai-builder:run_evaluation" },
    );
    if (!resp.ok) throw new Error(resp.errorText || `provider ${resp.status}`);
    const args = extractToolArguments(resp, "submit_evaluation");
    if (!args) return { ok: false, code: "unknown", message: "Falha ao avaliar. Tente novamente." };

    return {
      ok: true,
      scenario_id: scenario.id,
      transcript,
      overall_score: Number(args.overall_score ?? 0),
      passed: !!args.passed,
      scores: args.scores ?? {},
      strengths: args.strengths ?? [],
      weaknesses: args.weaknesses ?? [],
      suggested_patch: String(args.suggested_patch ?? ""),
    };
  } catch (e) {
    const parsed = parseProviderError(e);
    return { ok: false, ...parsed };
  }
}



// ---------- Phase 6: Insights ----------

const INSIGHTS_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_insights",
    description: "Resume conversas reais do agente, aponta padrões e gera recomendações de melhoria.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Resumo executivo em 2-4 frases, PT-BR." },
        sentiment: { type: "string", enum: ["positive", "neutral", "negative", "mixed"] },
        top_objections: { type: "array", items: { type: "string" }, description: "Até 5 objeções recorrentes dos leads." },
        top_doubts: { type: "array", items: { type: "string" }, description: "Até 5 dúvidas recorrentes." },
        top_interests: { type: "array", items: { type: "string" }, description: "Até 5 interesses/temas que mais aparecem." },
        drop_off_reasons: { type: "array", items: { type: "string" }, description: "Motivos pelos quais leads desistem ou somem." },
        recommendations: {
          type: "array",
          description: "3-6 recomendações acionáveis de melhoria para o agente.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string" },
              area: { type: "string", enum: ["prompt", "kb", "config", "process"] },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["title", "detail", "area", "priority"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "sentiment", "top_objections", "top_doubts", "top_interests", "drop_off_reasons", "recommendations"],
      additionalProperties: false,
    },
  },
};

async function actionGenerateInsights(builder: Agent, payload: Record<string, unknown>) {
  const agentId = String(payload.agent_id ?? "");
  if (!agentId) return { ok: false, code: "missing_agent", status: 400, message: "agent_id obrigatório." };
  const days = Math.max(1, Math.min(90, Number(payload.days ?? 14)));

  const supabase = sb();
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("id, clinic_id, name, system_prompt, role")
    .eq("id", agentId)
    .single();
  if (!agent) return { ok: false, code: "not_found", status: 404, message: "Agente não encontrado." };

  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const { data: threads } = await supabase
    .from("ai_threads")
    .select("id, title, created_at, lead_id")
    .eq("agent_id", agentId)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(40);

  const threadIds = (threads ?? []).map((t: any) => t.id);
  let messages: any[] = [];
  if (threadIds.length) {
    const { data: msgs } = await supabase
      .from("ai_messages")
      .select("thread_id, role, content, created_at")
      .in("thread_id", threadIds)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(600);
    messages = msgs ?? [];
  }

  if (!messages.length) {
    return {
      ok: false,
      code: "no_data",
      status: 400,
      message: `Sem conversas nos últimos ${days} dias para analisar.`,
    };
  }

  const byThread = new Map<string, any[]>();
  for (const m of messages) {
    const arr = byThread.get(m.thread_id) ?? [];
    arr.push(m);
    byThread.set(m.thread_id, arr);
  }

  const transcripts = Array.from(byThread.entries()).slice(0, 25).map(([tid, arr], idx) => {
    const head = arr.slice(0, 16);
    const body = head.map((m) => {
      const c = String(m.content ?? "").replace(/\s+/g, " ").slice(0, 280);
      return `${m.role === "user" ? "LEAD" : "AGENTE"}: ${c}`;
    }).join("\n");
    return `--- Conversa ${idx + 1} (id=${tid.slice(0, 8)}) ---\n${body}`;
  }).join("\n\n");

  const userPrompt = `\
Analise as conversas reais abaixo do agente "${agent.name}" (papel: ${agent.role ?? "agente"}) nos últimos ${days} dias.

System prompt atual (resumo):
${String(agent.system_prompt ?? "").slice(0, 1200)}

Conversas (${byThread.size} threads, ${messages.length} mensagens analisadas):
${transcripts}

Regras:
- Foque em padrões reais, não em casos isolados.
- "recommendations" devem ser ações concretas (ex: "Adicionar FAQ sobre prazos de entrega" em vez de "melhorar comunicação").
- Marque area="kb" quando faltar informação, "prompt" quando o tom/regras precisarem mudar, "config" para parâmetros técnicos, "process" para fluxo do negócio.
- PT-BR. Sem emoji.

Chame submit_insights.`;

  try {
    const resp = await chatCompletion(
      builder,
      [
        { role: "system", content: await buildBuilderSystemPrompt() },
        { role: "user", content: userPrompt },
      ],
      [INSIGHTS_TOOL],
      { agent_id: builder.id, note: "ai-builder:generate_insights" },
    );
    if (!resp.ok) throw new Error(resp.errorText || `provider ${resp.status}`);
    const args = extractToolArguments(resp, "submit_insights");
    if (!args) return { ok: false, code: "unknown", message: "O Construtor não devolveu insights. Tente novamente." };

    // persiste em ai_insights
    const periodStart = since;
    const periodEnd = new Date().toISOString();
    const { data: inserted } = await supabase
      .from("ai_insights")
      .insert({
        clinic_id: agent.clinic_id,
        agent_id: agentId,
        period_start: periodStart,
        period_end: periodEnd,
        summary: String(args.summary ?? ""),
        sentiment: String(args.sentiment ?? "neutral"),
        top_objections: args.top_objections ?? [],
        top_doubts: args.top_doubts ?? [],
        top_interests: args.top_interests ?? [],
        drop_off_reasons: args.drop_off_reasons ?? [],
        recommendations: args.recommendations ?? [],
        raw: {
          threads_analyzed: byThread.size,
          messages_analyzed: messages.length,
          days,
        },
      })
      .select("id, created_at")
      .single();

    return {
      ok: true,
      insight_id: inserted?.id,
      created_at: inserted?.created_at,
      summary: args.summary,
      sentiment: args.sentiment,
      top_objections: args.top_objections ?? [],
      top_doubts: args.top_doubts ?? [],
      top_interests: args.top_interests ?? [],
      drop_off_reasons: args.drop_off_reasons ?? [],
      recommendations: args.recommendations ?? [],
      threads_analyzed: byThread.size,
      messages_analyzed: messages.length,
    };
  } catch (e) {
    const parsed = parseProviderError(e);
    return { ok: false, ...parsed };
  }
}





// ---------- Fase 10: Co-piloto de configuração ----------

// Espelha src/lib/agent-tools.ts — manter em sincronia.
const KNOWN_AGENT_TOOLS_EDGE = new Set<string>([
  "move_lead_stage", "add_lead_note", "set_lead_field", "update_custom_field",
  "assign_attendant", "remember_fact", "transfer_to_human", "create_task",
  "schedule_message", "get_lead_history", "add_lead_tag", "remove_lead_tag",
  "get_lead_state", "search_knowledge_base", "generate_insight_report",
]);

function filterKnownToolsEdge(tools: unknown): string[] {
  if (!Array.isArray(tools)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tools) {
    if (typeof t !== "string") continue;
    const name = t.trim();
    if (!name || seen.has(name) || !KNOWN_AGENT_TOOLS_EDGE.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

const COPILOT_PATCH_TOOL = {
  type: "function" as const,
  function: {
    name: "propose_agent_patch",
    description:
      "Proponha alterações concretas no agente do usuário. Só inclua campos que devem MUDAR. " +
      "Se a conversa for só dúvida/explicação, retorne 'changes' vazio e use 'message' para responder.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Resposta curta em PT-BR para o usuário (1-3 frases). Sempre obrigatória.",
        },
        summary: {
          type: "string",
          description:
            "Frase única descrevendo o patch (ex.: 'respostas mais curtas e sem pedir nome/telefone'). " +
            "Vazia se changes estiver vazio.",
        },
        rationale: {
          type: "string",
          description: "Por que esse patch resolve o pedido do usuário. 1-3 frases.",
        },
        changes: {
          type: "object",
          description:
            "Campos do agente a alterar. Omita o que não muda. Se não houver mudança, use objeto vazio.",
          properties: {
            system_prompt: {
              type: "string",
              description:
                "Novo system_prompt COMPLETO (não diff). Mantenha as seções existentes e a cláusula 'Use o contexto do lead antes de perguntar'.",
            },
            temperature: { type: "number", minimum: 0, maximum: 1 },
            draft_mode: { type: "boolean" },
            rag_top_k: { type: "integer", minimum: 1, maximum: 20 },
            debounce_seconds: { type: "integer", minimum: 0, maximum: 600 },
            tools: {
              type: "array",
              items: { type: "string" },
              description:
                "Lista COMPLETA de tools desejadas (não delta). Use APENAS nomes da whitelist: " +
                "move_lead_stage, add_lead_note, set_lead_field, update_custom_field, assign_attendant, " +
                "remember_fact, transfer_to_human, create_task, schedule_message, get_lead_history, " +
                "add_lead_tag, remove_lead_tag, get_lead_state, search_knowledge_base, generate_insight_report.",
            },
          },
          additionalProperties: false,
        },
      },
      required: ["message", "changes"],
      additionalProperties: false,
    },
  },
};

async function actionCopilotChat(builder: Agent, payload: Record<string, unknown>) {
  const agentId = String(payload.agent_id ?? "");
  if (!agentId) return { ok: false, code: "missing_agent", status: 400, message: "agent_id obrigatório." };

  const supabase = sb();
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("id, clinic_id, name, niche, role, provider, model, system_prompt, temperature, draft_mode, enabled, rag_top_k, debounce_seconds, tools")
    .eq("id", agentId)
    .single();
  if (!agent) return { ok: false, code: "not_found", status: 404, message: "Agente não encontrado." };

  const history = Array.isArray(payload.messages) ? (payload.messages as Array<{ role: string; content: string }>) : [];
  const cleanHistory = history
    .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    .slice(-12)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 4000) }));
  if (cleanHistory.length === 0) {
    return { ok: false, code: "missing_messages", status: 400, message: "Envie ao menos uma mensagem do usuário." };
  }

  const promptSnippet = (agent.system_prompt ?? "").slice(0, 4000);
  const currentTools = Array.isArray(agent.tools) ? agent.tools.join(", ") : "(nenhuma)";

  const system = await buildBuilderSystemPrompt();
  const copilotIntro = `\

Você está no modo CO-PILOTO de configuração: o usuário conversa com você para AJUSTAR um agente já existente.

# Agente atual
- Nome: ${agent.name ?? "(sem nome)"}
- Nicho: ${agent.niche ?? "outro"} · Papel: ${agent.role ?? "custom"}
- Provedor/modelo: ${agent.provider ?? "?"} / ${agent.model ?? "?"}
- temperature: ${agent.temperature ?? "?"} · draft_mode: ${agent.draft_mode ?? false} · enabled: ${agent.enabled ?? false}
- rag_top_k: ${agent.rag_top_k ?? "?"} · debounce_seconds: ${agent.debounce_seconds ?? "?"}
- tools ativas: ${currentTools}

# System prompt atual (primeiros 4000 chars)
---
${promptSnippet}
---

# Regras
- Sempre chame a tool 'propose_agent_patch'.
- Se o usuário pediu uma MUDANÇA concreta, devolva 'changes' com os campos a alterar e 'summary' não vazio.
- Se for apenas dúvida/conversa, devolva 'changes' vazio e responda no campo 'message'.
- Ao mexer em 'system_prompt', devolva o prompt COMPLETO reescrito (não diff). Preserve a cláusula obrigatória 'Use o contexto do lead antes de perguntar'.
- Ao mexer em 'tools', devolva a lista COMPLETA desejada com nomes da whitelist.
- Seja conciso: 'message' tem 1-3 frases em PT-BR.
`;

  try {
    const resp = await chatCompletion(
      builder,
      [
        { role: "system", content: system + copilotIntro },
        ...cleanHistory,
      ],
      [COPILOT_PATCH_TOOL],
      { agent_id: builder.id, note: "ai-builder:copilot_chat" },
    );
    if (!resp.ok) {
      console.error("[copilot_chat] provider error", {
        status: resp.status,
        provider: builder.provider,
        model: builder.model,
        errorText: (resp.errorText || "").slice(0, 500),
      });
      throw new Error(resp.errorText || `provider ${resp.status}`);
    }

    const args = extractToolArguments(resp, "propose_agent_patch") as {
      message?: string;
      summary?: string;
      rationale?: string;
      changes?: Record<string, unknown>;
    } | null;

    if (!args) {
      const rawText = resp?.choices?.[0]?.message?.content ?? "";
      console.error("[copilot_chat] no tool_call from provider", {
        provider: builder.provider,
        model: builder.model,
        sample: String(rawText).slice(0, 240),
      });
      return {
        ok: false,
        code: "invalid_response",
        status: 200,
        message:
          "O Co-piloto não devolveu um patch estruturado (o modelo respondeu em texto livre). " +
          "Tente reformular o pedido de forma mais concreta, ou troque o modelo do Construtor por um que suporte tool calling.",
      };
    }

    // Sanitize patch
    const rawChanges = (args.changes ?? {}) as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    if (typeof rawChanges.system_prompt === "string" && rawChanges.system_prompt.trim().length > 20) {
      sanitized.system_prompt = ensureContextClause(rawChanges.system_prompt);
    }
    if (typeof rawChanges.temperature === "number" && rawChanges.temperature >= 0 && rawChanges.temperature <= 1) {
      sanitized.temperature = Number(rawChanges.temperature);
    }
    if (typeof rawChanges.draft_mode === "boolean") sanitized.draft_mode = rawChanges.draft_mode;
    if (Number.isFinite(rawChanges.rag_top_k as number)) {
      const n = Math.max(1, Math.min(20, Math.round(Number(rawChanges.rag_top_k))));
      sanitized.rag_top_k = n;
    }
    if (Number.isFinite(rawChanges.debounce_seconds as number)) {
      const n = Math.max(0, Math.min(600, Math.round(Number(rawChanges.debounce_seconds))));
      sanitized.debounce_seconds = n;
    }
    if (Array.isArray(rawChanges.tools)) {
      sanitized.tools = filterKnownToolsEdge(rawChanges.tools);
    }

    return {
      ok: true,
      message: String(args.message ?? "").trim() || "Pronto.",
      summary: String(args.summary ?? "").trim(),
      rationale: String(args.rationale ?? "").trim(),
      changes: sanitized,
      has_changes: Object.keys(sanitized).length > 0,
    };
  } catch (e) {
    console.error("[copilot_chat] caught", e);
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
      case "suggest_kb_urls": {
        if (!builder.api_key) return json({ error: "Configure a chave de API do Construtor antes." }, 400);
        const result = await actionSuggestKbUrls(builder, body.payload ?? {});
        return json(result, result.ok ? 200 : (result as { status?: number }).status ?? 400);
      }
      case "draft_knowledge_base": {
        if (!builder.api_key) return json({ error: "Configure a chave de API do Construtor antes." }, 400);
        const result = await actionDraftKnowledgeBase(builder, body.payload ?? {});
        return json(result, result.ok ? 200 : (result as { status?: number }).status ?? 400);
      }
      case "audit_kb": {
        if (!builder.api_key) return json({ error: "Configure a chave de API do Construtor antes." }, 400);
        const result = await actionAuditKb(builder, body.payload ?? {});
        return json(result, result.ok ? 200 : (result as { status?: number }).status ?? 400);
      }
      case "generate_scenarios": {
        if (!builder.api_key) return json({ error: "Configure a chave de API do Construtor antes." }, 400);
        const result = await actionGenerateScenarios(builder, body.payload ?? {});
        return json(result, result.ok ? 200 : (result as { status?: number }).status ?? 400);
      }
      case "run_evaluation": {
        if (!builder.api_key) return json({ error: "Configure a chave de API do Construtor antes." }, 400);
        const result = await actionRunEvaluation(builder, body.payload ?? {});
        return json(result, result.ok ? 200 : (result as { status?: number }).status ?? 400);
      }
      case "generate_insights": {
        if (!builder.api_key) {
          return json({ ok: false, code: "missing_key", message: "Configure a chave de API do Construtor antes." }, 200);
        }
        const result = await actionGenerateInsights(builder, body.payload ?? {});
        // Sempre 200: erros tratados vão no body (ok:false + message) para o supabase-js entregar o detalhe ao cliente.
        return json(result, 200);
      }
      case "copilot_chat": {
        if (!builder.api_key) {
          return json({ ok: false, code: "missing_key", message: "Configure a chave de API do Construtor antes de usar o Co-piloto." }, 200);
        }
        const result = await actionCopilotChat(builder, body.payload ?? {});
        // Sempre 200: erros tratados vão no body (ok:false + message) para o supabase-js entregar o detalhe ao cliente.
        return json(result, 200);
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

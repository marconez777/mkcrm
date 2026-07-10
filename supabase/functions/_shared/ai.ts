// Multi-provider AI helpers. Each agent carries provider + api_key + optional base_url.
// Chat: OpenAI / Anthropic / Google. Returned shape is normalized to OpenAI-like:
//   { ok, status, choices:[{message:{content, tool_calls?:[{id,function:{name,arguments}}]}}], usage:{prompt_tokens,completion_tokens,total_tokens} }
// Embeddings: all vectors are forced to 768 dims to match ai_chunks.
//
// All chat and embed calls auto-log to ai_usage when a `ctx` is provided.

import { logUsage } from "./metrics.ts";

export type LogCtx = {
  agent_id?: string | null;
  lead_id?: string | null;
  thread_id?: string | null;
  automation_id?: string | null;
  /** Free-form label appended to error column when status==="success" (e.g. "hyde", "rewrite", "ingest"). */
  note?: string | null;
};

export type Provider = "openai" | "anthropic" | "google" | "xai" | "manus" | "lovable";

export type Agent = {
  id: string;
  provider: Provider;
  api_key: string | null;
  base_url: string | null;
  model: string;
  temperature: number;
  embedding_model?: string | null;
  embedding_api_key?: string | null;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

export type NormalizedResponse = {
  ok: boolean;
  status: number;
  errorText?: string;
  /** True for 429/408/5xx/network errors — caller may retry with backoff. */
  retryable?: boolean;
  choices: Array<{
    message: {
      role: "assistant";
      content: string;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

/** HTTP statuses we treat as transient (rate-limit / timeout / upstream failure). */
export function isRetryableStatus(s: number): boolean {
  return s === 408 || s === 425 || s === 429 || (s >= 500 && s <= 599);
}

function requireKey(agent: Agent) {
  if (!agent.api_key) throw new Error(`Agent ${agent.id} sem api_key configurada`);
  return agent.api_key;
}

function compactErrorText(text: string, max = 500): string {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

// ---------- CHAT ----------

export async function chatCompletion(
  agent: Agent,
  messages: ChatMessage[],
  tools?: any[],
  ctx?: LogCtx,
): Promise<NormalizedResponse> {
  const startedAt = Date.now();
  // Plano Supreme: quando provider === "lovable", usa a LOVABLE_API_KEY do ambiente.
  if (agent.provider === "lovable") {
    const envKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
    if (envKey) agent = { ...agent, api_key: envKey };
  }
  let resp: NormalizedResponse;
  try {
    if (agent.provider === "openai") resp = await openaiChat(agent, messages, tools);
    else if (agent.provider === "xai") resp = await openaiCompatibleChat(agent, messages, tools, "https://api.x.ai/v1");
    else if (agent.provider === "lovable") {
      resp = await openaiCompatibleChat(agent, messages, tools, agent.base_url || "https://ai.gateway.lovable.dev/v1");
    }
    else if (agent.provider === "manus") {
      if (!agent.base_url) throw new Error(`Agent ${agent.id} (Manus) requer Base URL configurada`);
      resp = await openaiCompatibleChat(agent, messages, tools, agent.base_url);
    }
    else if (agent.provider === "anthropic") resp = await anthropicChat(agent, messages, tools);
    else if (agent.provider === "google") resp = await googleChat(agent, messages, tools);
    else throw new Error(`unknown provider ${agent.provider}`);
  } catch (e) {
    if (ctx) {
      logUsage({
        ...ctx, model: agent.model, operation: "chat", status: "error",
        error: String(e).slice(0, 500), latency_ms: Date.now() - startedAt,
      });
    }
    throw e;
  }
  if (ctx) {
    const u = resp.usage;
    logUsage({
      ...ctx, model: agent.model, operation: "chat",
      status: resp.ok ? "success" : "error",
      input_tokens: u?.prompt_tokens ?? null,
      output_tokens: u?.completion_tokens ?? null,
      total_tokens: u?.total_tokens ?? null,
      latency_ms: Date.now() - startedAt,
      error: resp.ok ? (ctx.note ?? null) : (resp.errorText?.slice(0, 500) ?? `provider ${resp.status}`),
    });
  }
  return resp;
}

async function openaiChat(agent: Agent, messages: ChatMessage[], tools?: any[]): Promise<NormalizedResponse> {
  const url = (agent.base_url?.replace(/\/+$/, "") || "https://api.openai.com/v1") + "/chat/completions";
  // OpenAI reasoning models (o1, o3, o4, gpt-5*) only accept temperature=1 (default) and
  // reject the `temperature` field entirely with 400 invalid_request_error.
  const isReasoning = /^(o\d|gpt-5)/i.test(agent.model);
  const body: Record<string, unknown> = {
    model: agent.model,
    messages,
    tools: tools && tools.length > 0 ? tools : undefined,
  };
  if (!isReasoning) {
    body.temperature = Number(agent.temperature) || 0.7;
  }
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireKey(agent)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, status: r.status, errorText: await r.text(), retryable: isRetryableStatus(r.status), choices: [] };
  const data = await r.json();
  return { ok: true, status: 200, choices: data.choices ?? [], usage: data.usage };
}

// xAI (Grok) and Manus expose OpenAI-compatible /chat/completions endpoints.
async function openaiCompatibleChat(
  agent: Agent,
  messages: ChatMessage[],
  tools: any[] | undefined,
  defaultBaseUrl: string,
): Promise<NormalizedResponse> {
  const base = agent.base_url?.replace(/\/+$/, "") || defaultBaseUrl;
  const url = `${base}/chat/completions`;
  const body: Record<string, unknown> = {
    model: agent.model,
    messages,
    tools: tools && tools.length > 0 ? tools : undefined,
    temperature: Number(agent.temperature) || 0.7,
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireKey(agent)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, status: r.status, errorText: await r.text(), retryable: isRetryableStatus(r.status), choices: [] };
  const data = await r.json();
  return { ok: true, status: 200, choices: data.choices ?? [], usage: data.usage };
}

async function anthropicChat(agent: Agent, messages: ChatMessage[], tools?: any[]): Promise<NormalizedResponse> {
  // Split out system, fold tool messages into user blocks
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const conv: any[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      conv.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content ?? "" }],
      });
      continue;
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      const blocks: any[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls) {
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function?.name,
          input: JSON.parse(tc.function?.arguments ?? "{}"),
        });
      }
      conv.push({ role: "assistant", content: blocks });
      continue;
    }
    conv.push({ role: m.role, content: m.content ?? "" });
  }

  const aTools = tools?.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));

  const url = (agent.base_url?.replace(/\/+$/, "") || "https://api.anthropic.com/v1") + "/messages";
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": requireKey(agent),
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: agent.model,
      system: sys || undefined,
      messages: conv,
      tools: aTools && aTools.length > 0 ? aTools : undefined,
      temperature: Number(agent.temperature) || 0.7,
      max_tokens: 2048,
    }),
  });
  if (!r.ok) return { ok: false, status: r.status, errorText: await r.text(), retryable: isRetryableStatus(r.status), choices: [] };
  const data = await r.json();
  let text = "";
  const tool_calls: any[] = [];
  for (const b of data.content ?? []) {
    if (b.type === "text") text += b.text;
    if (b.type === "tool_use") {
      tool_calls.push({
        id: b.id,
        type: "function",
        function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      });
    }
  }
  return {
    ok: true,
    status: 200,
    choices: [{ message: { role: "assistant", content: text, tool_calls: tool_calls.length ? tool_calls : undefined } }],
    usage: {
      prompt_tokens: data.usage?.input_tokens,
      completion_tokens: data.usage?.output_tokens,
      total_tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    },
  };
}

async function googleChat(agent: Agent, messages: ChatMessage[], tools?: any[]): Promise<NormalizedResponse> {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents: any[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: m.name ?? "tool", response: { result: m.content ?? "" } } }],
      });
      continue;
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.tool_calls) {
        parts.push({ functionCall: { name: tc.function?.name, args: JSON.parse(tc.function?.arguments ?? "{}") } });
      }
      contents.push({ role: "model", parts });
      continue;
    }
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content ?? "" }],
    });
  }

  const gTools = tools?.length
    ? [{ functionDeclarations: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: sanitizeGeminiSchema(t.function.parameters),
      })) }]
    : undefined;

  const buildBody = (opts: { includeSystemInstruction: boolean }) => {
    const contentsFinal = [...contents];
    if (sys && !opts.includeSystemInstruction) {
      // v1 endpoint (or retries) may not accept systemInstruction — prepend as user turn.
      contentsFinal.unshift({ role: "user", parts: [{ text: `[System]\n${sys}` }] });
    }
    return JSON.stringify({
      contents: contentsFinal,
      ...(opts.includeSystemInstruction && sys
        ? { systemInstruction: { parts: [{ text: sys }] } }
        : {}),
      tools: gTools,
      generationConfig: { temperature: Number(agent.temperature) || 0.7 },
    });
  };
  const apiKey = requireKey(agent);
  const base = agent.base_url?.replace(/\/+$/, "") || "https://generativelanguage.googleapis.com/v1beta";
  const url = `${base}/models/${encodeURIComponent(agent.model)}:generateContent?key=${apiKey}`;
  let r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: buildBody({ includeSystemInstruction: true }),
  });
  // Fallback chain when v1beta rejects (e.g. 404 model, or 400 systemInstruction):
  // try v1 with systemInstruction, then v1 without systemInstruction (prepended to contents).
  if (!r.ok && (r.status === 404 || r.status === 400) && !agent.base_url && base.endsWith("/v1beta")) {
    const firstErrorText = await r.text();
    const v1Url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(agent.model)}:generateContent?key=${apiKey}`;
    let retry = await fetch(v1Url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buildBody({ includeSystemInstruction: true }),
    });
    let secondErrorText = "";
    if (!retry.ok && (retry.status === 400 || retry.status === 404)) {
      secondErrorText = await retry.text();
      retry = await fetch(v1Url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildBody({ includeSystemInstruction: false }),
      });
    }
    if (retry.ok) {
      r = retry;
    } else {
      const retryErrorText = await retry.text();
      console.error("[googleChat] provider error", {
        status: retry.status,
        model: agent.model,
        error: compactErrorText(retryErrorText),
        fallback_from_v1beta: compactErrorText(firstErrorText, 240),
        fallback_v1_with_sys: secondErrorText ? compactErrorText(secondErrorText, 240) : undefined,
        messages: messages.length,
        tools: tools?.length ?? 0,
      });
      return { ok: false, status: retry.status, errorText: retryErrorText || secondErrorText || firstErrorText, retryable: isRetryableStatus(retry.status), choices: [] };
    }
  }

  if (!r.ok) {
    const errorText = await r.text();
    console.error("[googleChat] provider error", {
      status: r.status,
      model: agent.model,
      error: compactErrorText(errorText),
      messages: messages.length,
      tools: tools?.length ?? 0,
    });
    return { ok: false, status: r.status, errorText, retryable: isRetryableStatus(r.status), choices: [] };
  }
  const data = await r.json();
  const cand = data.candidates?.[0];
  let text = "";
  const tool_calls: any[] = [];
  let i = 0;
  for (const p of cand?.content?.parts ?? []) {
    if (p.text) text += p.text;
    if (p.functionCall) {
      tool_calls.push({
        id: `call_${i++}_${Date.now()}`,
        type: "function",
        function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args ?? {}) },
      });
    }
  }
  return {
    ok: true,
    status: 200,
    choices: [{ message: { role: "assistant", content: text, tool_calls: tool_calls.length ? tool_calls : undefined } }],
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount,
      completion_tokens: data.usageMetadata?.candidatesTokenCount,
      total_tokens: data.usageMetadata?.totalTokenCount,
    },
  };
}

function sanitizeGeminiSchema(schema: any): any | undefined {
  if (!schema || typeof schema !== "object") return undefined;

  const clone = JSON.parse(JSON.stringify(schema));
  const unsupported = new Set([
    "$schema",
    "$id",
    "$defs",
    "definitions",
    "$ref",
    "default",
    "additionalProperties",
    "nullable",
    "strict",
    "oneOf",
    "anyOf",
    "allOf",
    "not",
    "format",
    "pattern",
    "minimum",
    "maximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
  ]);

  const clean = (node: any): any | undefined => {
    if (!node || typeof node !== "object") return undefined;
    if (Array.isArray(node)) return node.map(clean).filter(Boolean);

    for (const key of Object.keys(node)) {
      if (unsupported.has(key)) delete node[key];
    }

    if (Array.isArray(node.type)) {
      node.type = node.type.find((t: unknown) => t !== "null") ?? "string";
    }

    if (node.properties && typeof node.properties === "object") {
      for (const key of Object.keys(node.properties)) {
        const child = clean(node.properties[key]);
        if (child) node.properties[key] = child;
        else delete node.properties[key];
      }
      if (node.type === "object" && Object.keys(node.properties).length === 0) {
        delete node.properties;
        delete node.required;
      }
    }

    if (node.items) {
      const items = clean(node.items);
      if (items) node.items = items;
      else delete node.items;
    }

    if (Array.isArray(node.required) && node.properties) {
      const props = new Set(Object.keys(node.properties));
      node.required = node.required.filter((key: unknown) => typeof key === "string" && props.has(key));
      if (node.required.length === 0) delete node.required;
    }

    if (!node.type) {
      if (node.properties) node.type = "object";
      else if (node.items) node.type = "array";
      else node.type = "string";
    }

    if (node.type === "array" && !node.items) {
      node.items = { type: "string" };
    }

    return node;
  };

  const result = clean(clone);
  if (!result) return undefined;
  if (result.type === "object" && result.properties && Object.keys(result.properties).length === 0) return undefined;
  return result;
}

// ---------- EMBEDDINGS (always 768 dims to match ai_chunks) ----------

export async function embed(agent: Agent, texts: string[], ctx?: LogCtx): Promise<number[][]> {
  const startedAt = Date.now();
  let model = "unknown";
  try {
    let vectors: number[][];
    // Pick embedding provider based on the agent's configured provider/key.
    if (agent.embedding_api_key) {
      model = normalizeOpenAIEmbeddingModel(agent.embedding_model || "text-embedding-3-small");
      vectors = await openaiEmbed(agent.embedding_api_key, model, texts, agent.base_url);
    } else if (agent.provider === "openai") {
      model = normalizeOpenAIEmbeddingModel(agent.embedding_model || "text-embedding-3-small");
      vectors = await openaiEmbed(requireKey(agent), model, texts, agent.base_url);
    } else if (agent.provider === "google") {
      // Uses the agent's own Gemini API key. Default to gemini-embedding-001
      // (v1beta) which supports outputDimensionality=768 to match ai_chunks.
      model = agent.embedding_model || "gemini-embedding-001";
      vectors = await googleEmbed(requireKey(agent), model, texts);
    } else if (agent.provider === "lovable") {
      const key = Deno.env.get("LOVABLE_API_KEY");
      if (!key) throw new Error("LOVABLE_API_KEY não configurada no servidor");
      model = normalizeLovableEmbeddingModel(agent.embedding_model);
      vectors = await lovableEmbed(key, model, texts);
    } else {
      throw new Error(`Provider ${agent.provider} não suporta embeddings nativamente. Configure embedding_api_key (OpenAI).`);
    }

    if (ctx) {
      // OpenAI/Google embedding APIs return token counts only on OpenAI; we estimate via char/4 fallback.
      const approxIn = texts.reduce((s, t) => s + Math.ceil((t?.length ?? 0) / 4), 0);
      logUsage({
        ...ctx, model, operation: "embed", status: "success",
        input_tokens: approxIn, output_tokens: 0, total_tokens: approxIn,
        latency_ms: Date.now() - startedAt,
        error: ctx.note ?? null,
      });
    }
    return vectors;
  } catch (e) {
    if (ctx) {
      logUsage({
        ...ctx, model, operation: "embed", status: "error",
        error: String(e).slice(0, 500), latency_ms: Date.now() - startedAt,
      });
    }
    throw e;
  }
}

function normalizeOpenAIEmbeddingModel(model: string): string {
  if (model.startsWith("openai/")) return model.replace(/^openai\//, "");
  return model;
}

function normalizeLovableEmbeddingModel(model?: string | null): string {
  if (!model || model === "text-embedding-004" || model === "text-embedding-3-small") {
    return "openai/text-embedding-3-small";
  }
  if (model === "text-embedding-3-large") return "openai/text-embedding-3-large";
  if (model.startsWith("openai/")) return model;
  if (model.startsWith("google/")) return "openai/text-embedding-3-small";
  return "openai/text-embedding-3-small";
}

async function openaiEmbed(key: string, model: string, texts: string[], baseUrl?: string | null): Promise<number[][]> {
  const url = (baseUrl?.replace(/\/+$/, "") || "https://api.openai.com/v1") + "/embeddings";
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts, dimensions: 768 }),
  });
  if (!r.ok) throw new Error(`openai embed ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return (data.data ?? []).map((d: any) => d.embedding as number[]);
}

async function googleEmbed(key: string, model: string, texts: string[]): Promise<number[][]> {
  const body = JSON.stringify({
    requests: texts.map((t) => ({
      model: `models/${model}`,
      content: { parts: [{ text: t }] },
      outputDimensionality: 768,
    })),
  });
  // Try v1beta first (supports gemini-embedding-001 and text-embedding-004),
  // fall back to v1 if the key/model isn't enabled on v1beta.
  const call = async (apiVersion: "v1beta" | "v1") => {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:batchEmbedContents?key=${key}`;
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  };
  let r = await call("v1beta");
  if (r.status === 404) {
    const fallback = await call("v1");
    if (fallback.ok) r = fallback;
    else {
      const t1 = await r.text().catch(() => "");
      const t2 = await fallback.text().catch(() => "");
      throw new Error(`google embed 404 v1beta+v1 model=${model}: ${t1.slice(0,200)} | ${t2.slice(0,200)}`);
    }
  }
  if (!r.ok) throw new Error(`google embed ${r.status} model=${model}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return (data.embeddings ?? []).map((e: any) => e.values as number[]);
}



async function lovableEmbed(key: string, model: string, texts: string[]): Promise<number[][]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Lovable-API-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: texts, dimensions: 768 }),
  });
  if (!r.ok) throw new Error(`lovable embed ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return (data.data ?? []).map((d: any) => d.embedding as number[]);
}

/** Naive char-based chunker with overlap. */
export function chunkText(text: string, size = 800, overlap = 100): string[] {
  const out: string[] = [];
  const clean = text.replace(/\r/g, "").trim();
  if (clean.length <= size) return [clean];
  let i = 0;
  while (i < clean.length) {
    out.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}

// ---------- KNOWLEDGE CLEANUP ----------
// Reescreve texto bruto extraído de páginas/PDFs em formato amigável para indexação,
// usando o MESMO provider/API key configurado no agente (OpenAI, Google, Anthropic, etc).
// Em caso de erro, retorna o texto original (ingest nunca quebra por causa disso).

const CLEAN_SYSTEM_PROMPT = `Você é um editor de base de conhecimento.
Receberá texto bruto extraído automaticamente de uma página web ou PDF.
Sua tarefa é REESCREVER o texto em português claro e bem formatado, para servir como base de conhecimento de um agente de IA.

REGRAS OBRIGATÓRIAS:
- Remova menus de navegação, breadcrumbs, links de "Agendar Consulta"/CTAs repetidos, números de CRM/RQE soltos, rodapés, copyright, cookies, redes sociais, formulários.
- Preserve 100% do conteúdo informativo (definições, procedimentos, indicações, contraindicações, FAQ, dados clínicos, preços, horários, etc.). NÃO resuma e NÃO invente nada.
- Organize em parágrafos com títulos curtos usando markdown (## Seção). Use listas com "-" quando fizer sentido.
- Mantenha o idioma original do texto.
- Se houver perguntas e respostas, formate como "**Pergunta:** ...\\n**Resposta:** ...".
- Não inclua comentários sobre o processo nem prefixos como "Aqui está...". Retorne apenas o conteúdo limpo.`;

async function cleanChunkWithAgent(agent: Agent, raw: string, meta: { sourceUrl?: string; title?: string }): Promise<string | null> {
  const userMsg = [
    meta.title ? `Título: ${meta.title}` : null,
    meta.sourceUrl ? `Fonte: ${meta.sourceUrl}` : null,
    "",
    "TEXTO BRUTO:",
    raw,
  ].filter((x) => x !== null).join("\n");

  try {
    const resp = await chatCompletion(agent, [
      { role: "system", content: CLEAN_SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ], undefined, { agent_id: agent.id, note: "knowledge_clean" });
    if (!resp.ok) {
      console.warn(`[cleanForKnowledge] provider ${resp.status}: ${resp.errorText?.slice(0, 200)}`);
      return null;
    }
    const out = resp.choices?.[0]?.message?.content;
    if (typeof out !== "string" || out.trim().length < 20) return null;
    return out.trim();
  } catch (e) {
    console.warn(`[cleanForKnowledge] erro:`, e);
    return null;
  }
}

/**
 * Limpa texto bruto em formato amigável para a base de conhecimento usando o
 * provider/API key do próprio agente. Processa em janelas quando o input é grande.
 * Em caso de falha, retorna o texto original.
 */
export async function cleanForKnowledge(
  agent: Agent,
  rawText: string,
  meta: { sourceUrl?: string; title?: string } = {},
): Promise<string> {
  const text = (rawText || "").trim();
  if (text.length < 200) return text;
  if (!agent.api_key) return text;

  const MAX = 25_000;
  if (text.length <= MAX) {
    const cleaned = await cleanChunkWithAgent(agent, text, meta);
    return cleaned ?? text;
  }

  const parts: string[] = [];
  const step = MAX - 500;
  for (let i = 0; i < text.length; i += step) parts.push(text.slice(i, i + MAX));

  const cleanedParts: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const c = await cleanChunkWithAgent(agent, parts[i], {
      ...meta,
      title: meta.title ? `${meta.title} (parte ${i + 1}/${parts.length})` : undefined,
    });
    cleanedParts.push(c ?? parts[i]);
  }
  return cleanedParts.join("\n\n");
}



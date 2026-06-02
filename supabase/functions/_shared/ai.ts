// Multi-provider AI helpers. Each agent carries provider + api_key + optional base_url.
// Chat: OpenAI / Anthropic / Google. Returned shape is normalized to OpenAI-like:
//   { ok, status, choices:[{message:{content, tool_calls?:[{id,function:{name,arguments}}]}}], usage:{prompt_tokens,completion_tokens,total_tokens} }
// Embeddings: provider-native (openai or google). All embeddings forced to 768 dims to match ai_chunks.
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

export type Provider = "openai" | "anthropic" | "google" | "xai" | "manus";

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

// ---------- CHAT ----------

export async function chatCompletion(
  agent: Agent,
  messages: ChatMessage[],
  tools?: any[],
  ctx?: LogCtx,
): Promise<NormalizedResponse> {
  const startedAt = Date.now();
  let resp: NormalizedResponse;
  try {
    if (agent.provider === "openai") resp = await openaiChat(agent, messages, tools);
    else if (agent.provider === "xai") resp = await openaiCompatibleChat(agent, messages, tools, "https://api.x.ai/v1");
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
        parameters: t.function.parameters,
      })) }]
    : undefined;

  const base = agent.base_url?.replace(/\/+$/, "") || "https://generativelanguage.googleapis.com/v1beta";
  const url = `${base}/models/${encodeURIComponent(agent.model)}:generateContent?key=${requireKey(agent)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
      tools: gTools,
      generationConfig: { temperature: Number(agent.temperature) || 0.7 },
    }),
  });
  if (!r.ok) return { ok: false, status: r.status, errorText: await r.text(), retryable: isRetryableStatus(r.status), choices: [] };
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

// ---------- EMBEDDINGS (always 768 dims to match ai_chunks) ----------

export async function embed(agent: Agent, texts: string[], ctx?: LogCtx): Promise<number[][]> {
  const startedAt = Date.now();
  let model = "unknown";
  try {
    let vectors: number[][];
    // Pick embedding provider: explicit embedding_api_key (OpenAI-compatible) wins,
    // else use the same provider's native embedding endpoint.
    if (agent.embedding_api_key) {
      model = agent.embedding_model || "text-embedding-3-small";
      vectors = await openaiEmbed(agent.embedding_api_key, model, texts, agent.base_url);
    } else if (agent.provider === "openai") {
      model = agent.embedding_model || "text-embedding-3-small";
      vectors = await openaiEmbed(requireKey(agent), model, texts, agent.base_url);
    } else if (agent.provider === "google") {
      model = agent.embedding_model || "text-embedding-004";
      vectors = await googleEmbed(requireKey(agent), model, texts);
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
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const url = `${base}/models/${encodeURIComponent(model)}:batchEmbedContents?key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((t) => ({
        model: `models/${model}`,
        content: { parts: [{ text: t }] },
        outputDimensionality: 768,
      })),
    }),
  });
  if (!r.ok) throw new Error(`google embed ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return (data.embeddings ?? []).map((e: any) => e.values as number[]);
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

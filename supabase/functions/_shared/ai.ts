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

export type Agent = {
  id: string;
  provider: "openai" | "anthropic" | "google";
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

function requireKey(agent: Agent) {
  if (!agent.api_key) throw new Error(`Agent ${agent.id} sem api_key configurada`);
  return agent.api_key;
}

// ---------- CHAT ----------

export async function chatCompletion(
  agent: Agent,
  messages: ChatMessage[],
  tools?: any[],
): Promise<NormalizedResponse> {
  if (agent.provider === "openai") return openaiChat(agent, messages, tools);
  if (agent.provider === "anthropic") return anthropicChat(agent, messages, tools);
  if (agent.provider === "google") return googleChat(agent, messages, tools);
  throw new Error(`unknown provider ${agent.provider}`);
}

async function openaiChat(agent: Agent, messages: ChatMessage[], tools?: any[]): Promise<NormalizedResponse> {
  const url = (agent.base_url?.replace(/\/+$/, "") || "https://api.openai.com/v1") + "/chat/completions";
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireKey(agent)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: agent.model,
      messages,
      temperature: Number(agent.temperature) || 0.7,
      tools: tools && tools.length > 0 ? tools : undefined,
    }),
  });
  if (!r.ok) return { ok: false, status: r.status, errorText: await r.text(), choices: [] };
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
  if (!r.ok) return { ok: false, status: r.status, errorText: await r.text(), choices: [] };
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
  if (!r.ok) return { ok: false, status: r.status, errorText: await r.text(), choices: [] };
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

export async function embed(agent: Agent, texts: string[]): Promise<number[][]> {
  // Pick embedding provider: explicit embedding_api_key (OpenAI-compatible) wins,
  // else use the same provider's native embedding endpoint.
  if (agent.embedding_api_key) {
    return openaiEmbed(agent.embedding_api_key, agent.embedding_model || "text-embedding-3-small", texts, agent.base_url);
  }
  if (agent.provider === "openai") {
    return openaiEmbed(requireKey(agent), agent.embedding_model || "text-embedding-3-small", texts, agent.base_url);
  }
  if (agent.provider === "google") {
    return googleEmbed(requireKey(agent), agent.embedding_model || "text-embedding-004", texts);
  }
  throw new Error(`Provider ${agent.provider} não suporta embeddings nativamente. Configure embedding_api_key (OpenAI).`);
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

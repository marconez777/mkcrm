// Shared utilities for caching, hashing and dedup.
// Used by ai-chat, _shared/rag.ts, evolution-webhook, ai-auto-reply.

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stable JSON stringify (sorted keys) for deterministic hashing of tool args. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Promise with hard timeout (rejects after ms). */
export function withTimeout<T>(p: Promise<T>, ms: number, label = "op"): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms)),
  ]);
}

/** Bounded-concurrency map (semaphore). */
export async function pmap<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------- Embedding cache ----------

export async function getCachedEmbedding(supabase: any, text: string, model: string): Promise<number[] | null> {
  const text_hash = await sha256Hex(`${model}::${text}`);
  const { data } = await supabase
    .from("embedding_cache")
    .select("embedding")
    .eq("text_hash", text_hash)
    .eq("model", model)
    .maybeSingle();
  if (!data?.embedding) return null;
  // pgvector returns string representation "[0.1,0.2,...]"
  if (typeof data.embedding === "string") {
    try { return JSON.parse(data.embedding); } catch { return null; }
  }
  return data.embedding as number[];
}

export async function setCachedEmbedding(supabase: any, text: string, model: string, embedding: number[]): Promise<void> {
  const text_hash = await sha256Hex(`${model}::${text}`);
  await supabase.from("embedding_cache").upsert({ text_hash, model, embedding } as any, { onConflict: "text_hash,model" });
}

// ---------- RAG cache ----------

const RAG_TTL_MS = 10 * 60 * 1000; // 10min

export async function getCachedRetrieval(supabase: any, agentId: string, queryKey: string): Promise<any[] | null> {
  const query_hash = await sha256Hex(queryKey);
  const { data } = await supabase
    .from("rag_cache").select("chunks, created_at")
    .eq("agent_id", agentId).eq("query_hash", query_hash).maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.created_at).getTime() > RAG_TTL_MS) return null;
  return data.chunks as any[];
}

export async function setCachedRetrieval(supabase: any, agentId: string, queryKey: string, chunks: any[]): Promise<void> {
  const query_hash = await sha256Hex(queryKey);
  await supabase.from("rag_cache").upsert({ agent_id: agentId, query_hash, chunks } as any, { onConflict: "agent_id,query_hash" });
}

// ---------- Webhook dedup ----------

export async function isWebhookDuplicate(supabase: any, eventKey: string): Promise<boolean> {
  const event_hash = await sha256Hex(eventKey);
  const { error } = await supabase.from("webhook_dedup").insert({ event_hash } as any);
  // Insert succeeds = first time. Conflict (duplicate key) = already seen.
  return !!error && /duplicate|conflict|unique/i.test(error.message ?? "");
}

// ---------- Lead reply rate limit ----------

export async function checkAndIncrementLeadReplyCounter(
  supabase: any, leadId: string, maxPerHour: number,
): Promise<{ allowed: boolean; count: number }> {
  const hour = new Date(); hour.setMinutes(0, 0, 0);
  const { data } = await supabase
    .from("lead_reply_counters").select("count")
    .eq("lead_id", leadId).eq("hour_bucket", hour.toISOString()).maybeSingle();
  const current = data?.count ?? 0;
  if (current >= maxPerHour) return { allowed: false, count: current };
  await supabase.from("lead_reply_counters").upsert(
    { lead_id: leadId, hour_bucket: hour.toISOString(), count: current + 1, last_bot_sent_at: new Date().toISOString() } as any,
    { onConflict: "lead_id,hour_bucket" },
  );
  return { allowed: true, count: current + 1 };
}

export async function getLeadLastBotSentAt(supabase: any, leadId: string): Promise<Date | null> {
  const hour = new Date(); hour.setMinutes(0, 0, 0);
  const { data } = await supabase
    .from("lead_reply_counters").select("last_bot_sent_at")
    .eq("lead_id", leadId).eq("hour_bucket", hour.toISOString()).maybeSingle();
  return data?.last_bot_sent_at ? new Date(data.last_bot_sent_at) : null;
}

// ---------- Tracing ----------

export async function logTrace(supabase: any, p: {
  run_id: string; agent_id?: string | null; thread_id?: string | null; lead_id?: string | null;
  step: number; kind: string; name?: string | null;
  latency_ms?: number | null; tokens_in?: number | null; tokens_out?: number | null;
  error?: string | null; payload?: any;
}) {
  try {
    await supabase.rpc("log_agent_trace", {
      p_run_id: p.run_id, p_agent_id: p.agent_id ?? null, p_thread_id: p.thread_id ?? null, p_lead_id: p.lead_id ?? null,
      p_step: p.step, p_kind: p.kind, p_name: p.name ?? null,
      p_latency_ms: p.latency_ms ?? null, p_tokens_in: p.tokens_in ?? null, p_tokens_out: p.tokens_out ?? null,
      p_error: p.error ?? null, p_payload: p.payload ?? null,
    });
  } catch (e) {
    console.error("logTrace failed", e);
  }
}

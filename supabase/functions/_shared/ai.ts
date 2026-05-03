// Shared helpers for Lovable AI Gateway calls.
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export function aiKey() {
  const k = Deno.env.get("LOVABLE_API_KEY");
  if (!k) throw new Error("LOVABLE_API_KEY not configured");
  return k;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

export async function chatCompletion(opts: {
  model: string;
  messages: ChatMessage[];
  tools?: any[];
  tool_choice?: any;
  temperature?: number;
  stream?: boolean;
}) {
  const resp = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(opts),
  });
  return resp;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const resp = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/text-embedding-004",
      input: texts,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`embed ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  return (data?.data ?? []).map((d: any) => d.embedding as number[]);
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

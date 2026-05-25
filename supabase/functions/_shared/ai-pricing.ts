// Static pricing table per 1M tokens (USD). Mirror of src/lib/ai-pricing.ts
// so edge functions can materialize cost_usd at insert time (price-of-the-day
// persists with the row; UI doesn't need to recompute and history stays stable
// when providers change prices).

type Price = { in: number; out: number };

const PRICING: Record<string, Price> = {
  "gpt-5": { in: 1.25, out: 10.0 },
  "gpt-5-mini": { in: 0.25, out: 2.0 },
  "gpt-5-nano": { in: 0.05, out: 0.4 },
  "gpt-4o": { in: 2.5, out: 10.0 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4.1": { in: 2.0, out: 8.0 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1-nano": { in: 0.1, out: 0.4 },
  "o1": { in: 15.0, out: 60.0 },
  "o3": { in: 2.0, out: 8.0 },
  "o3-mini": { in: 1.1, out: 4.4 },
  "o4-mini": { in: 1.1, out: 4.4 },
  "text-embedding-3-small": { in: 0.02, out: 0 },
  "text-embedding-3-large": { in: 0.13, out: 0 },
  "text-embedding-ada-002": { in: 0.1, out: 0 },
  "gemini-2.5-pro": { in: 1.25, out: 10.0 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "gemini-3-flash-preview": { in: 0.3, out: 2.5 },
  "gemini-3.1-pro-preview": { in: 1.25, out: 10.0 },
  "text-embedding-004": { in: 0.0, out: 0 },
  "claude-3-5-sonnet": { in: 3.0, out: 15.0 },
  "claude-3-5-haiku": { in: 0.8, out: 4.0 },
  "claude-3-opus": { in: 15.0, out: 75.0 },
};

function normalize(model: string): string {
  const m = model.split("/").pop() || model;
  return m.replace(/-\d{4}-\d{2}-\d{2}.*$/, "");
}

export function calcCostUsd(model: string, inTok: number | null | undefined, outTok: number | null | undefined): number | null {
  if (!model) return null;
  const key = normalize(model);
  let p = PRICING[key];
  if (!p) {
    for (const k of Object.keys(PRICING)) {
      if (key.startsWith(k)) { p = PRICING[k]; break; }
    }
  }
  if (!p) return null;
  const i = inTok ?? 0;
  const o = outTok ?? 0;
  const cost = (i * p.in + o * p.out) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

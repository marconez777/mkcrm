// Tabela estática de preços por 1M tokens (USD).
// Atualize quando os provedores mudarem preços.
// Fontes: https://openai.com/api/pricing/ e https://ai.google.dev/pricing

type Price = { in: number; out: number };

const PRICING: Record<string, Price> = {
  // OpenAI - chat
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
  // OpenAI - embeddings (output ~ 0)
  "text-embedding-3-small": { in: 0.02, out: 0 },
  "text-embedding-3-large": { in: 0.13, out: 0 },
  "text-embedding-ada-002": { in: 0.1, out: 0 },
  // Google
  "gemini-2.5-pro": { in: 1.25, out: 10.0 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "gemini-3-flash-preview": { in: 0.3, out: 2.5 },
  "gemini-3.1-pro-preview": { in: 1.25, out: 10.0 },
  "text-embedding-004": { in: 0.0, out: 0 },
  // Anthropic
  "claude-3-5-sonnet": { in: 3.0, out: 15.0 },
  "claude-3-5-haiku": { in: 0.8, out: 4.0 },
  "claude-3-opus": { in: 15.0, out: 75.0 },
};

function normalizeModel(model: string): string {
  // remove prefixos "openai/", "google/", "anthropic/"
  const m = model.split("/").pop() || model;
  // remove sufixos de data: gpt-4o-2024-08-06 -> gpt-4o
  return m.replace(/-\d{4}-\d{2}-\d{2}.*$/, "").replace(/-preview$/, "-preview");
}

export function getPrice(model: string): Price | null {
  const key = normalizeModel(model);
  if (PRICING[key]) return PRICING[key];
  // fallback parcial: prefixo
  for (const k of Object.keys(PRICING)) {
    if (key.startsWith(k)) return PRICING[k];
  }
  return null;
}

export function calcCost(model: string, inTokens: number | null | undefined, outTokens: number | null | undefined): number {
  const p = getPrice(model);
  if (!p) return 0;
  const i = inTokens ?? 0;
  const o = outTokens ?? 0;
  return (i * p.in + o * p.out) / 1_000_000;
}

export function fmtUSD(v: number): string {
  if (v === 0) return "$0";
  if (v < 0.01) return `$${v.toFixed(5)}`;
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

export function isModelKnown(model: string): boolean {
  return getPrice(model) !== null;
}

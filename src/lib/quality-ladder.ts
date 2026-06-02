// Maps a "Velocidade ↔ Qualidade" slider (0..2) to a concrete model per provider.
// Index 0 = mais rápido / barato; último índice = melhor qualidade.

export type Provider = "openai" | "anthropic" | "google" | "xai" | "manus";

export const QUALITY_LADDER: Record<Provider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
  anthropic: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-opus-4-20250514"],
  google: ["gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
  xai: ["grok-2-mini", "grok-2-mini", "grok-2-latest"],
  manus: [],
};

export const QUALITY_LABELS = ["Rápido", "Equilíbrio", "Qualidade"] as const;

export function modelForQuality(provider: Provider, q: number): string {
  const ladder = QUALITY_LADDER[provider] ?? [];
  if (ladder.length === 0) return "";
  const i = Math.max(0, Math.min(ladder.length - 1, Math.round(q)));
  return ladder[i];
}

export function qualityForModel(provider: Provider, model: string): number {
  const ladder = QUALITY_LADDER[provider] ?? [];
  const i = ladder.indexOf(model);
  return i >= 0 ? i : 1;
}

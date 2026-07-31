// Origem do lead — catálogo canônico compartilhado pela UI.
// Espelha supabase/functions/_shared/lead-origin.ts.

export type OriginChannel =
  | "google_organic"
  | "google_ads"
  | "meta_ads"
  | "instagram"
  | "facebook"
  | "youtube"
  | "email"
  | "referral"
  | "form"
  | "whatsapp_direct"
  | "test"
  | "other"
  | "unknown";

export const ORIGIN_LABELS: Record<OriginChannel, string> = {
  google_organic: "Google — Orgânico",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  email: "E-mail marketing",
  referral: "Indicação",
  form: "Formulário do site",
  whatsapp_direct: "WhatsApp direto",
  test: "Teste",
  other: "Outros",
  unknown: "Indeterminado",
};

export const ORIGIN_CHANNELS = Object.keys(ORIGIN_LABELS) as OriginChannel[];

export function originLabelOf(lead: {
  origin_label?: string | null;
  origin_channel?: string | null;
}): string | null {
  if (lead.origin_label) return lead.origin_label;
  const ch = lead.origin_channel as OriginChannel | undefined | null;
  return ch ? ORIGIN_LABELS[ch] ?? ch : null;
}

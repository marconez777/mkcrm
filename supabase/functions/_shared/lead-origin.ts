// supabase/functions/_shared/lead-origin.ts
//
// Origem do lead — regra única para todos os tenants.
//
// Fonte da verdade: tracking_lead_sources (conversion_touch > last_non_direct >
// first_touch). Fallbacks: formulário, e-mail marketing, WhatsApp direto, teste.
//
// Nunca sobrescreve origem travada por edição humana (leads.origin_locked_by_user).

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

export type OriginResolution = {
  origin_channel: OriginChannel;
  origin_label: string;
  origin_detail: string | null;
  origin_source_type: string;
};

type TouchRow = {
  source_type?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  channel_group?: string | null;
  referrer?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
};

const PAID_MEDIUMS = /(cpc|ppc|paid|ads|paidsocial|paid_social)/i;

/** Classifica um toque de tracking em canal canônico. */
export function channelFromTouch(t: TouchRow): OriginChannel {
  const src = (t.source ?? "").toLowerCase();
  const med = (t.medium ?? "").toLowerCase();
  const grp = (t.channel_group ?? "").toLowerCase();
  const ref = (t.referrer ?? "").toLowerCase();
  const paid = PAID_MEDIUMS.test(med) || !!t.gclid || !!t.gbraid || !!t.wbraid || !!t.fbclid;

  if (med === "email" || grp === "email" || /(mailchimp|resend|newsletter|e-?mail)/.test(src)) {
    return "email";
  }
  if (src.includes("google") || grp === "organic_search" || grp === "paid_search") {
    if (paid || grp === "paid_search") return "google_ads";
    if (src.includes("google")) return "google_organic";
  }
  if (src.includes("youtube") || ref.includes("youtube")) return "youtube";
  if (src.includes("instagram") || ref.includes("instagram") || src === "ig") {
    return paid ? "meta_ads" : "instagram";
  }
  if (src.includes("facebook") || ref.includes("facebook") || src === "fb" || src.includes("meta")) {
    return paid ? "meta_ads" : "facebook";
  }
  if (paid) return grp === "paid_social" ? "meta_ads" : "google_ads";
  if (grp === "organic_search") return "google_organic";
  if (grp === "referral" || (!!t.referrer && med === "referral")) return "referral";
  if (grp === "organic_social") return "other";
  if (grp === "direct" || src === "direct") return "unknown";
  if (src) return "other";
  return "unknown";
}

function detailFromTouch(t: TouchRow): string | null {
  const parts = [t.source, t.medium, t.campaign].filter(Boolean) as string[];
  return parts.length ? parts.join(" / ") : null;
}

const TOUCH_PRIORITY = ["conversion_touch", "last_non_direct", "first_touch"];

/** Escolhe o melhor toque disponível e resolve o canal. */
export function resolveFromTouches(rows: TouchRow[]): OriginResolution | null {
  if (!rows?.length) return null;
  const sorted = [...rows].sort(
    (a, b) =>
      TOUCH_PRIORITY.indexOf(a.source_type ?? "") - TOUCH_PRIORITY.indexOf(b.source_type ?? ""),
  );
  for (const row of sorted) {
    const channel = channelFromTouch(row);
    if (channel === "unknown") continue;
    return {
      origin_channel: channel,
      origin_label: ORIGIN_LABELS[channel],
      origin_detail: detailFromTouch(row),
      origin_source_type: `tracking:${row.source_type ?? "unknown"}`,
    };
  }
  const first = sorted[0];
  return {
    origin_channel: "unknown",
    origin_label: ORIGIN_LABELS.unknown,
    origin_detail: detailFromTouch(first),
    origin_source_type: `tracking:${first.source_type ?? "unknown"}`,
  };
}

export function originFor(
  channel: OriginChannel,
  detail: string | null,
  sourceType: string,
): OriginResolution {
  return {
    origin_channel: channel,
    origin_label: ORIGIN_LABELS[channel],
    origin_detail: detail,
    origin_source_type: sourceType,
  };
}

type MinimalClient = {
  from: (t: string) => any;
};

/**
 * Aplica a origem no lead.
 * - Respeita a trava humana (origin_locked_by_user).
 * - Só sobrescreve uma origem automática existente se a nova tiver prioridade
 *   maior (tracking > formulário/e-mail > whatsapp direto/teste > unknown).
 */
const RANK: Record<string, number> = {
  tracking: 4,
  form: 3,
  email: 3,
  whatsapp_direct: 2,
  test: 2,
  fallback: 1,
};

function rankOf(sourceType: string): number {
  const key = sourceType.split(":")[0];
  return RANK[key] ?? 1;
}

export async function applyLeadOrigin(
  client: MinimalClient,
  leadId: string,
  resolution: OriginResolution,
): Promise<{ applied: boolean; reason?: string }> {
  const { data: lead } = await client
    .from("leads")
    .select("id, origin_channel, origin_source_type, origin_locked_by_user")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { applied: false, reason: "lead_not_found" };
  if (lead.origin_locked_by_user) return { applied: false, reason: "locked_by_user" };

  if (lead.origin_channel) {
    const currentRank = rankOf(lead.origin_source_type ?? "fallback");
    const nextRank = rankOf(resolution.origin_source_type);
    if (nextRank < currentRank) return { applied: false, reason: "lower_priority" };
    if (nextRank === currentRank && resolution.origin_channel === "unknown") {
      return { applied: false, reason: "no_new_info" };
    }
  }

  const { error } = await client
    .from("leads")
    .update({
      origin_channel: resolution.origin_channel,
      origin_label: resolution.origin_label,
      origin_detail: resolution.origin_detail,
      origin_source_type: resolution.origin_source_type,
      origin_updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) return { applied: false, reason: error.message };
  return { applied: true };
}

/** Lê os toques do lead e aplica a origem derivada do tracking. */
export async function applyOriginFromTracking(
  client: MinimalClient,
  clinicId: string,
  leadId: string,
): Promise<{ applied: boolean; reason?: string }> {
  const { data: rows } = await client
    .from("tracking_lead_sources")
    .select("source_type, source, medium, campaign, channel_group, referrer, gclid, gbraid, wbraid, fbclid")
    .eq("clinic_id", clinicId)
    .eq("lead_id", leadId);

  const resolution = resolveFromTouches(rows ?? []);
  if (!resolution) return { applied: false, reason: "no_tracking" };
  return applyLeadOrigin(client, leadId, resolution);
}

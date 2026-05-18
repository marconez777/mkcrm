export type AttributionInput = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ttclid?: string | null;
  msclkid?: string | null;
  li_fat_id?: string | null;
  referrer?: string | null;
};

export type AttributionResult = {
  source: string;
  medium: string;
  campaign: string | null;
  content: string | null;
  term: string | null;
  channel_group: string;
  confidence_score: number;
  attribution_reason: string;
};

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  return v || null;
}

function classifyChannel(source: string | null, medium: string | null): string {
  if (!medium) return "unknown";
  if (["cpc", "ppc", "paid", "paid_search"].includes(medium)) return "paid_search";
  if (["paid_social", "social_paid"].includes(medium)) return "paid_social";
  if (medium === "organic") return "organic_search";
  if (["social", "organic_social"].includes(medium)) return "organic_social";
  if (medium === "email") return "email";
  if (medium === "referral") return "referral";
  return "other";
}

export function resolveTrafficSource(input: AttributionInput): AttributionResult {
  const source = normalize(input.utm_source);
  const medium = normalize(input.utm_medium);
  const campaign = normalize(input.utm_campaign);
  const content = normalize(input.utm_content);
  const term = normalize(input.utm_term);

  const hasGoogleClickId = !!(input.gclid || input.gbraid || input.wbraid);
  const hasMetaClickId = !!(input.fbclid || input.fbc);
  const hasTikTokClickId = !!input.ttclid;
  const hasMicrosoftClickId = !!input.msclkid;
  const hasLinkedInClickId = !!input.li_fat_id;

  // --- Prioridade 1: Click IDs ---
  if (hasGoogleClickId) {
    const coherent = !source || source === "google";
    return {
      source: "google",
      medium: medium || "cpc",
      campaign, content, term,
      channel_group: "paid_search",
      confidence_score: coherent ? 95 : 85,
      attribution_reason: "google_click_id",
    };
  }
  if (hasMetaClickId) {
    const coherent = !source || ["meta", "facebook", "instagram"].includes(source);
    return {
      source: coherent && source ? source : "meta",
      medium: medium || "paid_social",
      campaign, content, term,
      channel_group: "paid_social",
      confidence_score: coherent ? 95 : 85,
      attribution_reason: "meta_click_id",
    };
  }
  if (hasTikTokClickId) {
    return {
      source: "tiktok",
      medium: medium || "paid_social",
      campaign, content, term,
      channel_group: "paid_social",
      confidence_score: 90,
      attribution_reason: "tiktok_click_id",
    };
  }
  if (hasMicrosoftClickId) {
    return {
      source: "microsoft",
      medium: medium || "cpc",
      campaign, content, term,
      channel_group: "paid_search",
      confidence_score: 90,
      attribution_reason: "microsoft_click_id",
    };
  }
  if (hasLinkedInClickId) {
    return {
      source: "linkedin",
      medium: medium || "paid_social",
      campaign, content, term,
      channel_group: "paid_social",
      confidence_score: 90,
      attribution_reason: "linkedin_click_id",
    };
  }

  // --- Prioridade 2: UTMs ---
  if (source || medium || campaign) {
    return {
      source: source || "unknown",
      medium: medium || "unknown",
      campaign, content, term,
      channel_group: classifyChannel(source, medium),
      confidence_score: campaign ? 80 : 70,
      attribution_reason: "utm",
    };
  }

  // --- Prioridade 3: Referrer ---
  const ref = normalize(input.referrer);
  if (ref) {
    if (ref.includes("google.")) {
      return { source: "google", medium: "organic", campaign: null, content: null, term: null,
        channel_group: "organic_search", confidence_score: 65, attribution_reason: "referrer_google" };
    }
    if (ref.includes("bing.")) {
      return { source: "bing", medium: "organic", campaign: null, content: null, term: null,
        channel_group: "organic_search", confidence_score: 65, attribution_reason: "referrer_bing" };
    }
    if (ref.includes("duckduckgo.")) {
      return { source: "duckduckgo", medium: "organic", campaign: null, content: null, term: null,
        channel_group: "organic_search", confidence_score: 65, attribution_reason: "referrer_duckduckgo" };
    }
    if (ref.includes("instagram.") || ref.includes("l.instagram.")) {
      return { source: "instagram", medium: "organic_social", campaign: null, content: null, term: null,
        channel_group: "organic_social", confidence_score: 55, attribution_reason: "social_referrer" };
    }
    if (ref.includes("facebook.") || ref.includes("l.facebook.") || ref.includes("m.facebook.")) {
      return { source: "facebook", medium: "organic_social", campaign: null, content: null, term: null,
        channel_group: "organic_social", confidence_score: 55, attribution_reason: "social_referrer" };
    }
    if (ref.includes("linkedin.")) {
      return { source: "linkedin", medium: "organic_social", campaign: null, content: null, term: null,
        channel_group: "organic_social", confidence_score: 55, attribution_reason: "social_referrer" };
    }
    if (ref.includes("youtube.")) {
      return { source: "youtube", medium: "organic_social", campaign: null, content: null, term: null,
        channel_group: "organic_social", confidence_score: 55, attribution_reason: "social_referrer" };
    }
    return { source: ref, medium: "referral", campaign: null, content: null, term: null,
      channel_group: "referral", confidence_score: 50, attribution_reason: "external_referrer" };
  }

  // --- Prioridade 4: Direct ---
  return {
    source: "direct", medium: "none",
    campaign: null, content: null, term: null,
    channel_group: "direct",
    confidence_score: 30,
    attribution_reason: "no_referrer_no_params",
  };
}

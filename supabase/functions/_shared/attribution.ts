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
  if (medium === "ai") return "ai_assistant";
  if (medium === "email") return "email";
  if (medium === "referral") return "referral";
  return "other";
}

// Referrer host → { source, medium, channel_group }
// Order matters only inside the array (first match wins via String.includes on normalized referrer).
const REFERRER_RULES: Array<{ match: string; source: string; medium: string; channel_group: string; reason: string }> = [
  // AI assistants (treated as a distinct channel)
  { match: "chat.openai.com", source: "chatgpt", medium: "ai", channel_group: "ai_assistant", reason: "ai_chatgpt" },
  { match: "chatgpt.com", source: "chatgpt", medium: "ai", channel_group: "ai_assistant", reason: "ai_chatgpt" },
  { match: "perplexity.ai", source: "perplexity", medium: "ai", channel_group: "ai_assistant", reason: "ai_perplexity" },
  { match: "claude.ai", source: "claude", medium: "ai", channel_group: "ai_assistant", reason: "ai_claude" },
  { match: "gemini.google.com", source: "gemini", medium: "ai", channel_group: "ai_assistant", reason: "ai_gemini" },
  { match: "copilot.microsoft.com", source: "copilot", medium: "ai", channel_group: "ai_assistant", reason: "ai_copilot" },
  { match: "you.com", source: "you", medium: "ai", channel_group: "ai_assistant", reason: "ai_you" },
  { match: "poe.com", source: "poe", medium: "ai", channel_group: "ai_assistant", reason: "ai_poe" },
  // Search engines (organic)
  { match: "google.", source: "google", medium: "organic", channel_group: "organic_search", reason: "referrer_google" },
  { match: "bing.", source: "bing", medium: "organic", channel_group: "organic_search", reason: "referrer_bing" },
  { match: "duckduckgo.", source: "duckduckgo", medium: "organic", channel_group: "organic_search", reason: "referrer_duckduckgo" },
  { match: "yahoo.", source: "yahoo", medium: "organic", channel_group: "organic_search", reason: "referrer_yahoo" },
  { match: "yandex.", source: "yandex", medium: "organic", channel_group: "organic_search", reason: "referrer_yandex" },
  { match: "ecosia.", source: "ecosia", medium: "organic", channel_group: "organic_search", reason: "referrer_ecosia" },
  { match: "brave.com", source: "brave", medium: "organic", channel_group: "organic_search", reason: "referrer_brave" },
  // Video
  { match: "youtube.", source: "youtube", medium: "organic_social", channel_group: "organic_social", reason: "referrer_youtube" },
  { match: "youtu.be", source: "youtube", medium: "organic_social", channel_group: "organic_social", reason: "referrer_youtube" },
  // Social
  { match: "instagram.", source: "instagram", medium: "organic_social", channel_group: "organic_social", reason: "referrer_instagram" },
  { match: "l.instagram.", source: "instagram", medium: "organic_social", channel_group: "organic_social", reason: "referrer_instagram" },
  { match: "facebook.", source: "facebook", medium: "organic_social", channel_group: "organic_social", reason: "referrer_facebook" },
  { match: "l.facebook.", source: "facebook", medium: "organic_social", channel_group: "organic_social", reason: "referrer_facebook" },
  { match: "m.facebook.", source: "facebook", medium: "organic_social", channel_group: "organic_social", reason: "referrer_facebook" },
  { match: "linkedin.", source: "linkedin", medium: "organic_social", channel_group: "organic_social", reason: "referrer_linkedin" },
  { match: "tiktok.", source: "tiktok", medium: "organic_social", channel_group: "organic_social", reason: "referrer_tiktok" },
  { match: "reddit.", source: "reddit", medium: "organic_social", channel_group: "organic_social", reason: "referrer_reddit" },
  { match: "pinterest.", source: "pinterest", medium: "organic_social", channel_group: "organic_social", reason: "referrer_pinterest" },
  { match: "x.com", source: "x", medium: "organic_social", channel_group: "organic_social", reason: "referrer_x" },
  { match: "t.co", source: "x", medium: "organic_social", channel_group: "organic_social", reason: "referrer_x" },
  { match: "twitter.", source: "twitter", medium: "organic_social", channel_group: "organic_social", reason: "referrer_twitter" },
  { match: "threads.net", source: "threads", medium: "organic_social", channel_group: "organic_social", reason: "referrer_threads" },
  // Messaging
  { match: "wa.me", source: "whatsapp", medium: "referral", channel_group: "referral", reason: "referrer_whatsapp" },
  { match: "api.whatsapp.", source: "whatsapp", medium: "referral", channel_group: "referral", reason: "referrer_whatsapp" },
  { match: "web.whatsapp.", source: "whatsapp", medium: "referral", channel_group: "referral", reason: "referrer_whatsapp" },
  { match: "whatsapp.", source: "whatsapp", medium: "referral", channel_group: "referral", reason: "referrer_whatsapp" },
  { match: "t.me", source: "telegram", medium: "referral", channel_group: "referral", reason: "referrer_telegram" },
];

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

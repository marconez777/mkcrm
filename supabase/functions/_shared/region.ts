// _shared/region.ts — RegionConfig server-side (F-INTL-0).
// Espelha `src/lib/region.ts`. Mantenha as duas tabelas em sincronia.
//
// Decisões fechadas: Stripe ES/US, Evolution no MVP.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type Region = "br" | "es" | "us";
export type Currency = "BRL" | "EUR" | "USD";
export type PhoneCountry = "BR" | "ES" | "US";
export type PaymentProvider = "eduzz" | "stripe";
export type WhatsAppProvider = "evolution" | "meta_cloud";
export type LegalFramework = "LGPD" | "GDPR" | "CCPA" | "TCPA";

export interface RegionConfig {
  region: Region;
  locale: string;
  timezone: string;
  currency: Currency;
  phoneCountry: PhoneCountry;
  paymentProvider: PaymentProvider;
  whatsappProvider: WhatsAppProvider;
  legalFramework: LegalFramework[];
}

export const REGION_DEFAULTS: Record<Region, RegionConfig> = {
  br: {
    region: "br", locale: "pt-BR", timezone: "America/Sao_Paulo",
    currency: "BRL", phoneCountry: "BR",
    paymentProvider: "eduzz", whatsappProvider: "evolution", legalFramework: ["LGPD"],
  },
  es: {
    region: "es", locale: "es-ES", timezone: "Europe/Madrid",
    currency: "EUR", phoneCountry: "ES",
    paymentProvider: "stripe", whatsappProvider: "evolution", legalFramework: ["GDPR"],
  },
  us: {
    region: "us", locale: "en-US", timezone: "America/New_York",
    currency: "USD", phoneCountry: "US",
    paymentProvider: "stripe", whatsappProvider: "evolution", legalFramework: ["CCPA", "TCPA"],
  },
};

export function buildRegionConfig(
  region: string | null | undefined,
  overrides?: Partial<Pick<RegionConfig, "locale" | "timezone" | "currency" | "phoneCountry">>,
): RegionConfig {
  const key: Region = region === "es" || region === "us" ? region : "br";
  return { ...REGION_DEFAULTS[key], ...overrides };
}

// Cache em memória por clínica (TTL 60s) — chamadas se repetem dentro de um run.
const CACHE = new Map<string, { cfg: RegionConfig; expiresAt: number }>();
const TTL_MS = 60_000;

export async function getRegionConfig(
  client: SupabaseClient,
  clinicId: string,
): Promise<RegionConfig> {
  if (!clinicId) return REGION_DEFAULTS.br;

  const cached = CACHE.get(clinicId);
  if (cached && cached.expiresAt > Date.now()) return cached.cfg;

  const { data, error } = await client
    .from("clinics")
    .select("region, locale, timezone, currency, phone_country")
    .eq("id", clinicId)
    .maybeSingle();

  if (error || !data) {
    return REGION_DEFAULTS.br;
  }

  const cfg = buildRegionConfig(data.region, {
    locale: data.locale ?? undefined,
    timezone: data.timezone ?? undefined,
    currency: (data.currency as Currency) ?? undefined,
    phoneCountry: (data.phone_country as PhoneCountry) ?? undefined,
  });

  CACHE.set(clinicId, { cfg, expiresAt: Date.now() + TTL_MS });
  return cfg;
}

export function clearRegionCache(clinicId?: string): void {
  if (clinicId) CACHE.delete(clinicId);
  else CACHE.clear();
}

// RegionConfig — fonte única de verdade para parâmetros multi-região (F-INTL-0).
// Consumido por `useRegion()` no frontend e por `_shared/region.ts` nas edge functions.
//
// Decisões fechadas (ver `.lovable/plan.md`):
// - Pagamentos ES/US: Stripe. Eduzz fica BR-only.
// - WhatsApp ES/US: Evolution no MVP; Cloud API depois.

import type { PhoneCountry } from "@/lib/phone";

export type Region = "br" | "es" | "us";
export type Currency = "BRL" | "EUR" | "USD";
export type PaymentProvider = "eduzz" | "stripe";
export type WhatsAppProvider = "evolution" | "meta_cloud";
export type LegalFramework = "LGPD" | "GDPR" | "CCPA" | "TCPA";

export interface RegionConfig {
  region: Region;
  locale: string;            // BCP47 — pt-BR | es-ES | en-US
  timezone: string;          // IANA — America/Sao_Paulo | Europe/Madrid | America/New_York
  currency: Currency;
  phoneCountry: PhoneCountry;
  paymentProvider: PaymentProvider;
  whatsappProvider: WhatsAppProvider;
  legalFramework: LegalFramework[];
  /** Path prefix para o roteador do frontend ("" para BR, "/es", "/en"). */
  routePrefix: "" | "/es" | "/en";
}

export const REGION_DEFAULTS: Record<Region, RegionConfig> = {
  br: {
    region: "br",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    phoneCountry: "BR",
    paymentProvider: "eduzz",
    whatsappProvider: "evolution",
    legalFramework: ["LGPD"],
    routePrefix: "",
  },
  es: {
    region: "es",
    locale: "es-ES",
    timezone: "Europe/Madrid",
    currency: "EUR",
    phoneCountry: "ES",
    paymentProvider: "stripe",
    whatsappProvider: "evolution",
    legalFramework: ["GDPR"],
    routePrefix: "/es",
  },
  us: {
    region: "us",
    locale: "en-US",
    timezone: "America/New_York",
    currency: "USD",
    phoneCountry: "US",
    paymentProvider: "stripe",
    whatsappProvider: "evolution",
    legalFramework: ["CCPA", "TCPA"],
    routePrefix: "/en",
  },
};

/**
 * Aplica overrides parciais (vindos de `clinics.*`) sobre o default da região.
 * Usado pelo `useRegion()` e pela edge `getRegionConfig()`.
 */
export function buildRegionConfig(
  region: Region | string | null | undefined,
  overrides?: Partial<Pick<RegionConfig, "locale" | "timezone" | "currency" | "phoneCountry">>,
): RegionConfig {
  const key: Region = region === "es" || region === "us" ? region : "br";
  return { ...REGION_DEFAULTS[key], ...overrides };
}

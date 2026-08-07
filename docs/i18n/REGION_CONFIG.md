---
title: "RegionConfig — schema multi-região"
topic: architecture
kind: reference
audience: agent
updated: 2026-06-30
summary: "Schema do RegionConfig que parametriza locale, timezone, moeda, telefone e providers por clínica (BR/ES/US)."
code_refs:
  - src/lib/phone.ts
  - src/lib/broadcast-template.ts
related_docs:
  - docs/i18n/ROADMAP.md
  - docs/i18n/IMPORT_TEMPLATES.md
---

# RegionConfig

## Schema da migração (F-INTL-0)

```sql
ALTER TABLE public.clinics
  ADD COLUMN region        text NOT NULL DEFAULT 'br'  CHECK (region IN ('br','es','us')),
  ADD COLUMN locale        text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN timezone      text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN currency      text NOT NULL DEFAULT 'BRL',
  ADD COLUMN phone_country text NOT NULL DEFAULT 'BR';
```

## Defaults por região

| region | locale | timezone | currency | phone_country | date_format | number_format |
|---|---|---|---|---|---|---|
| `br` | `pt-BR` | `America/Sao_Paulo` | `BRL` | `BR` | `dd/MM/yyyy HH:mm` | `1.234,56` |
| `es` | `es-ES` | `Europe/Madrid` | `EUR` | `ES` | `dd/MM/yyyy HH:mm` | `1.234,56` |
| `us` | `en-US` | `America/New_York` | `USD` | `US` | `MM/dd/yyyy hh:mm a` | `1,234.56` |

> Timezone US é o **default**; clínicas em outros fusos (PT/CT/MT/AK/HI) editam manualmente.

## Frontend (`src/lib/region.ts`)

```ts
export type Region = 'br' | 'es' | 'us';

export interface RegionConfig {
  region: Region;
  locale: string;
  timezone: string;
  currency: 'BRL' | 'EUR' | 'USD';
  phoneCountry: 'BR' | 'ES' | 'US';
  paymentProvider: 'eduzz' | 'stripe';
  whatsappProvider: 'evolution' | 'meta_cloud';
  legalFramework: ('LGPD' | 'GDPR' | 'CCPA' | 'TCPA')[];
}

export function useRegion(): RegionConfig { /* lê de clinic_members → clinics */ }
```

## Edge functions (`_shared/region.ts`)

```ts
export async function getRegionConfig(
  client: SupabaseClient,
  clinicId: string,
): Promise<RegionConfig>;
```

Cache por `clinicId` (TTL 60s) — chamado por classifier, summarizer, summarizer trigger, webhook Evolution.

## Pontos de leitura

| Consumidor | Campo usado |
|---|---|
| `normalizePhone(raw, country)` | `phone_country` |
| `parseFutureDateInTZ(raw, tz, anchor)` | `timezone` |
| `formatMoney(amount, currency, locale)` | `currency`, `locale` |
| `downloadBroadcastTemplate(region)` | `region` |
| `KommoImportDialog` | `region`, `timezone`, `phone_country` |
| `i18n.changeLanguage(locale)` | `locale` |
| Stripe vs Eduzz checkout | `paymentProvider` |

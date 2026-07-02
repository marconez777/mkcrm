---
title: "i18n & Multi-região (BR/ES/US)"
topic: architecture
kind: map
audience: agent
updated: 2026-07-01
summary: "Hub agente para internacionalização e multi-região. Consolida RegionConfig, i18next, locales, timezone, moeda, telefone e providers por região."
code_refs:
  - src/i18n/
  - src/lib/region.ts
  - src/hooks/useRegion.ts
  - src/lib/phone.ts
  - supabase/functions/_shared/region.ts
related_docs:
  - docs/i18n/ROADMAP.md
  - docs/i18n/REGION_CONFIG.md
  - docs/i18n/IMPORT_TEMPLATES.md
  - docs/i18n/TRANSLATION_PROCESS.md
  - docs/i18n/COMPLIANCE.md
  - docs/maps/BILLING.md
---

# i18n & Multi-região — Mapa

Fase **F-DOC-FULL/13**. Consolida a stack multi-tenant BR/ES/US aprovada no
roadmap **F-INTL**. Uma única base de código, particionada por
`clinics.region`.

## Fonte de verdade

| Camada | Arquivo | Papel |
|---|---|---|
| Config estática | `src/lib/region.ts` | `REGION_DEFAULTS` + `buildRegionConfig()` |
| Espelho server | `supabase/functions/_shared/region.ts` | Mesmo schema, sem `routePrefix` |
| Hook React | `src/hooks/useRegion.ts` | Lê `clinics.region/locale/timezone/currency/phone_country` do tenant |
| Bootstrap i18n | `src/i18n/index.ts` | `i18next` + `react-i18next`, 3 locales embutidos |
| Sync locale | `src/i18n/useI18nSync.ts` | Muda `i18n.language` quando `useRegion().locale` muda |
| Locales | `src/i18n/locales/{pt-BR,es-ES,en-US}.json` | ~1.3k chaves cada, mesma árvore |

Invariante: **os três locales têm a mesma árvore de chaves**. Se pt-BR ganha
`x.y.z`, ES e US ganham no mesmo commit (mesmo que seja placeholder). O CI
de tradução (`scripts/i18n/*`, ver `docs/i18n/TRANSLATION_PROCESS.md`)
depende disso.

## RegionConfig

```ts
type Region = "br" | "es" | "us";
interface RegionConfig {
  region: Region;
  locale: "pt-BR" | "es-ES" | "en-US";
  timezone: "America/Sao_Paulo" | "Europe/Madrid" | "America/New_York";
  currency: "BRL" | "EUR" | "USD";
  phoneCountry: "BR" | "ES" | "US";
  paymentProvider: "eduzz" | "stripe";
  whatsappProvider: "evolution" | "meta_cloud";
  legalFramework: ("LGPD" | "GDPR" | "CCPA" | "TCPA")[];
  routePrefix: "" | "/es" | "/en"; // só no frontend
}
```

Defaults completos em `src/lib/region.ts` (BR/ES/US). Overrides parciais vêm
das colunas `clinics.locale/timezone/currency/phone_country`.

## Frontend

- **Bootstrap**: `App.tsx` importa `src/i18n` (side-effect) e monta
  `useI18nSync()` no shell autenticado.
- **Uso**: componentes chamam `const { t } = useTranslation()` — 41 arquivos
  cobertos (grep `useTranslation|useRegion`). Convenção de chaves: namespace
  por feature (`inbox.composer.send`, `billing.plan.upgrade`).
- **Roteamento**: prefixos `/es` e `/en` são reservados por `routePrefix`, mas
  hoje o app decide via `useRegion()` e não via URL — não confiar em prefixo
  ainda (dívida técnica listada abaixo).
- **Formatadores**: usar `Intl.NumberFormat`/`Intl.DateTimeFormat` com
  `useRegion().locale` + `.timezone`. Nunca hardcodar `pt-BR`.

## Backend (edge functions)

- `_shared/region.ts` replica `REGION_DEFAULTS` (sem `routePrefix`). Mantido
  em sincronia manual — quando mudar `src/lib/region.ts`, editar aqui também.
- Consumidores identificados: `broadcast-tick`, `automations-tick`,
  `sequence-tick`. Cada um resolve `RegionConfig` a partir do
  `clinic_id` para calcular janelas de envio, timezone e provider.
- `_shared/dates.ts` e `pipeline-classify/date-parser.ts` recebem `timezone`
  do RegionConfig — nunca assumir `America/Sao_Paulo`.

## Telefone / import / templates

- `src/lib/phone.ts` — normalização E.164 por `phoneCountry` (BR/ES/US).
- `KommoImportDialog.tsx` usa a `phoneCountry` da clínica para importar
  contatos sem prefixo.
- `src/lib/broadcast-template.ts` — placeholders localizáveis (`{{nome}}` etc)
  compartilhados por região; textos fixos vêm dos JSONs de locale.
- Detalhes em `docs/i18n/IMPORT_TEMPLATES.md`.

## Pagamentos

- BR → `paymentProvider: "eduzz"` (webhook legado, ver `docs/maps/BILLING.md`).
- ES/US → `paymentProvider: "stripe"` (checkout self-service, moeda do
  RegionConfig, ver `docs/maps/EXTERNAL_INTEGRATIONS.md`).
- Nunca cobrar em BRL fora de BR — o checkout usa `currency` do RegionConfig.

## WhatsApp

- MVP: todas as regiões em Evolution API.
- Meta Cloud API está no roadmap `F-META-*`. Quando ativado, alternar
  `whatsappProvider` na região (não por clínica individual sem passar pelo
  RegionConfig).

## Compliance

Detalhado em `docs/i18n/COMPLIANCE.md`. Resumo:

| Região | Framework | Efeito prático |
|---|---|---|
| BR | LGPD | Consentimento de contato, DPO, retenção |
| ES | GDPR | Consent explícito, DPO, direito ao esquecimento, DPA c/ subprocessadores |
| US | CCPA + TCPA | Opt-out "Do Not Sell", opt-in explícito para SMS/WhatsApp |

Textos legais e templates de email por região são carregados dos JSONs de
locale — nunca hardcodar disclaimers.

## Fluxo de tradução

1. Dev adiciona chave em `pt-BR.json` (fonte).
2. Roda `scripts/i18n/sync-keys.mjs` (ver `docs/i18n/TRANSLATION_PROCESS.md`)
   para inserir stubs em `es-ES.json` / `en-US.json`.
3. Tradução humana ou LLM-assistida preenche stubs.
4. CI valida paridade de chaves antes do merge.

## Invariantes (não quebrar sem ler)

1. `src/lib/region.ts` e `supabase/functions/_shared/region.ts` **precisam ter
   o mesmo `REGION_DEFAULTS`**. Editar os dois no mesmo commit.
2. Todos os 3 JSONs de locale têm exatamente a mesma árvore de chaves.
3. Nenhum componente pode usar `pt-BR`, `America/Sao_Paulo` ou `BRL` como
   literal — sempre via `useRegion()` / `useTranslation()`.
4. `paymentProvider` não é editável por clínica: é derivado da região.
5. `routePrefix` está reservado mas ainda não roteia — não adicionar links
   `/es/...` no código até a rota estar montada.

## Dívidas técnicas

- Roteamento por prefixo (`/es`, `/en`) reservado mas não implementado no
  `AppRoutes`. Hoje troca-se só o idioma; URL fica igual.
- Sync do `_shared/region.ts` é manual — sem teste que garanta paridade.
- Faltam formatadores utilitários centralizados (`formatCurrency`,
  `formatDate`) — cada componente instancia `Intl.*` ad-hoc.
- Meta Cloud API pendente (`F-META-*`).
- Textos de email transacional ainda misturam pt-BR em alguns templates
  legados (`resend-*`).

## Testes rápidos

- `useRegion().locale` reflete `clinics.locale` após reload? (mudar em
  `/admin/empresas` e recarregar).
- Trocar região BR→ES: preço no `/planos` deve virar EUR + Stripe.
- Import de contatos ES sem prefixo `+34` deve normalizar corretamente.

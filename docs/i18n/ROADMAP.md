---
title: "Roadmap i18n — Versões Espanha e EUA"
topic: roadmap
kind: roadmap
audience: agent
updated: 2026-06-30
summary: "Plano multi-fase para internacionalizar o Chat Funnel AI (BR/ES/US): região por clínica, i18n, timezone, moeda, telefone, templates de import e providers."
code_refs:
  - src/lib/phone.ts
  - src/lib/broadcast-template.ts
  - src/components/kanban/KommoImportDialog.tsx
  - supabase/functions/_shared/dates.ts
  - supabase/functions/pipeline-classify/date-parser.ts
related_docs:
  - docs/i18n/REGION_CONFIG.md
  - docs/i18n/IMPORT_TEMPLATES.md
  - docs/i18n/TRANSLATION_PROCESS.md
  - docs/i18n/COMPLIANCE.md
---

# Roadmap i18n — ES e US

Plano completo aprovado em `.lovable/plan.md`. Esta página é o índice versionado.

## Estratégia

Uma base de código, multi-tenant por região (`br` | `es` | `us`) em `clinics.region`. Cada região injeta um `RegionConfig` (locale, timezone, moeda, país do telefone, providers, templates).

## Fases

| ID | Tema | Esforço | Status |
|---|---|---|---|
| F-INTL-0 | Fundação (`clinics.region`, `RegionConfig`, `normalizePhone(country)`) | 1 sprint | pending |
| F-INTL-1 | i18n frontend (`react-i18next`, locales pt/es/en) | 2 sprints | pending |
| F-INTL-2 | Timezone (remover `America/Sao_Paulo` hardcoded) | 1 sprint | pending |
| F-INTL-3 | Moeda e billing multi-currency | 1 sprint | pending |
| F-INTL-3.5 | Templates de import por região (XLSX disparo + Kommo) | 0.5 sprint | pending |
| F-INTL-4 | Pagamentos por região (Stripe ES/US) | 2 sprints | pending |
| F-INTL-5 | WhatsApp Cloud API (ES/US) — depende F-META | — | bloqueado |
| F-INTL-6 | Agentes IA multilíngues | 2 sprints | pending |
| F-INTL-7 | Compliance (GDPR / CCPA / TCPA) | 1 sprint | pending |
| F-INTL-8 | SEO, marketing e domínios | 1 sprint | pending |
| F-INTL-9 | QA, beta e rollout | 1 sprint | pending |

## Decisões fechadas (2026-06-30)

1. Domínio: rotas por path — `chatfunnelai.com/es` e `/en`; PT-BR na raiz `/`.
2. Residência de dados UE: não tratar agora (Supabase US único).
3. PSP ES/US: Stripe. Eduzz fica BR-only.
4. WhatsApp ES/US: Evolution API no MVP; Cloud API depois (F-INTL-5).
5. Personas ES/US: sem playbook nativo agora — prompt PT traduzido.
6. TCPA US: `opt_in_date` recomendado, bloqueio fica no roadmap (F-INTL-7).

Detalhes e impacto por fase em `.lovable/plan.md`.

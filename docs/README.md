---
title: "Docs — Índice geral"
topic: general
kind: reference
audience: agent
updated: 2026-07-01
summary: "Ponto de entrada da documentação. Lista os 20 mapas de feature, roadmaps ativos e diretórios de estudo/pipeline/i18n."
related_docs:
  - docs/_audit/PROGRESS.md
  - docs/_audit/FINAL_REPORT.md
  - docs/_audit/INVENTORY.md
---

# Docs — Índice geral

Auditoria total concluída em **F-DOC-FULL** (14 fases). Progresso em
`docs/_audit/PROGRESS.md`; relatório final em `docs/_audit/FINAL_REPORT.md`.

## Mapas de feature (`docs/maps/`)

Cada mapa é o hub agente da feature: rotas, componentes, hooks, edges,
tabelas, invariantes e dívidas técnicas. Comece por aqui.

### Frontend & shell
- [FRONTEND_CORE](./maps/FRONTEND_CORE.md) — bootstrap, roteamento, auth, i18n, shell.
- [ADMIN_CONSOLE](./maps/ADMIN_CONSOLE.md) — `/admin/*`, guardas, painéis.

### Conversas & pipeline comercial
- [INBOX_KANBAN_LEADS](./maps/INBOX_KANBAN_LEADS.md) — Inbox, Kanban, Leads, Realtime.
- [PIPELINE_RUNTIME](./maps/PIPELINE_RUNTIME.md) — Classifier V6, watchdog, retries.
- [AI_AGENTS](./maps/AI_AGENTS.md) — agentes IA, BYOK, Spend Guard.

### Mensageria
- [WHATSAPP](./maps/WHATSAPP.md) · [EVOLUTION_EDGES](./maps/EVOLUTION_EDGES.md) · [BROADCASTS](./maps/BROADCASTS.md)
- [AUTOMATIONS](./maps/AUTOMATIONS.md) · [SEQUENCES](./maps/SEQUENCES.md) · [TEMPLATES](./maps/TEMPLATES.md) · [TASKS](./maps/TASKS.md)

### Marketing & aquisição
- [EMAIL_MARKETING](./maps/EMAIL_MARKETING.md) — Resend, campanhas, warmup.
- [TRACKING](./maps/TRACKING.md) · [FORMS](./maps/FORMS.md) · [METRICS](./maps/METRICS.md)

### Plataforma
- [BILLING](./maps/BILLING.md) — Stripe self-service + Eduzz legado.
- [STORAGE_UPLOADS](./maps/STORAGE_UPLOADS.md) — buckets, RLS, uploads.
- [EXTERNAL_INTEGRATIONS](./maps/EXTERNAL_INTEGRATIONS.md) — Evolution, Stripe, Resend, Eduzz, Gemini.
- [I18N_MULTIREGION](./maps/I18N_MULTIREGION.md) — BR/ES/US, RegionConfig, i18next.

## Diretórios especializados

- [`pipeline/`](./pipeline/README.md) — pipeline v4.2, cenários, schema, agentes auditores.
- [`pipeline/runtime/`](./pipeline/runtime/) — CLASSIFIER, FLOW_MATRIX e demais docs de runtime.
- [`estudo/`](./estudo/) e [`estudo-geral.md`](./estudo-geral.md) — estudo profundo das conversas (441 leads).
- [`i18n/`](./i18n/) — ROADMAP, REGION_CONFIG, IMPORT_TEMPLATES, TRANSLATION_PROCESS, COMPLIANCE.
- [`clinics/COMPARATIVO.md`](./clinics/COMPARATIVO.md) — diagnóstico por tenant.
- [`agents/`](./agents/) — prompts e personas dos agentes IA.
- [`archive/`](./archive/) — docs históricas.

## Roadmaps

- `docs/i18n/ROADMAP.md` — F-INTL (multi-região BR/ES/US).
- `docs/roadmap/META_API.md` (se presente) — F-META (WhatsApp Cloud API).

## Documentos temáticos

- [`Fluxo-atual.md`](./Fluxo-atual.md) — fluxo comercial/operacional consolidado.
- [`skill-datas.md`](./skill-datas.md) — datas × automações × agendamento.

## Como manter

Ver skill `docs-maintainer`. Regras curtas:

1. Toda doc começa com frontmatter (`title/topic/kind/audience/updated/summary/code_refs/related_docs`).
2. Ao mudar código, atualizar o mapa correspondente e o campo `updated`.
3. Novas features ganham mapa em `docs/maps/`.

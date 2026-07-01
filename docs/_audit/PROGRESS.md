---
title: "Progresso F-DOC-FULL"
topic: general
kind: reference
audience: agent
updated: 2026-07-01
summary: "Checklist vivo do roadmap de atualização total da documentação. Atualizado ao fim de cada fase."
---

# Progresso — F-DOC-FULL

Plano completo em `.lovable/plan.md`. Inventário em `docs/_audit/INVENTORY.md`.

## Status por fase

| Fase | Tema | Status | Entregáveis | Data |
|---|---|---|---|---|
| 0 | Baseline & inventário | ✅ done | `_audit/INVENTORY.md`, `_audit/PROGRESS.md` | 2026-07-01 |
| 1 | Núcleo frontend (rotas/shell/auth/i18n) | ✅ done | `docs/maps/FRONTEND_CORE.md` | 2026-07-01 |
| 2 | Inbox + Kanban + Leads | ✅ done | `docs/maps/INBOX_KANBAN_LEADS.md` | 2026-07-01 |
| 3 | Pipeline runtime | ✅ done | `docs/maps/PIPELINE_RUNTIME.md` (hub) + revalidação dos 20 arquivos em `docs/pipeline/runtime/` | 2026-07-01 |
| 4 | Agentes IA & IA Hub | ✅ done | `docs/maps/AI_AGENTS.md` | 2026-07-01 |
| 5 | WhatsApp / Evolution / Broadcasts | ✅ done | `docs/maps/{WHATSAPP,BROADCASTS,EVOLUTION_EDGES}.md` | 2026-07-01 |
| 6 | Automações / Sequências / Templates / Tarefas | ✅ done | `docs/maps/{AUTOMATIONS,SEQUENCES,TEMPLATES,TASKS}.md` | 2026-07-01 |
| 7 | Email Marketing | ✅ done | `docs/maps/EMAIL_MARKETING.md` | 2026-07-01 |
| 8 | Tracking / Formulários / Métricas | ✅ done | `docs/maps/{TRACKING,FORMS,METRICS}.md` | 2026-07-01 |
| 9 | Billing / Pagamentos / Planos | ⏳ pending | `docs/features/{BILLING,PLANS,STRIPE,EDUZZ}.md` | — |
| 10 | Admin / Suporte / Observabilidade | ⏳ pending | `docs/admin/*`, `docs/support/*` | — |
| 11 | Site marketing + Proposal `/apn` | ⏳ pending | `docs/marketing/{SITE,PROPOSAL}.md` | — |
| 12 | Banco (schema/RLS/funções/crons/secrets) | ⏳ pending | `docs/database/*` | — |
| 13 | i18n & Multi-região | ⏳ pending | atualizar `docs/i18n/*` | — |
| 14 | Consolidação final | ⏳ pending | `docs/README.md`, `_audit/FINAL_REPORT.md` | — |

## Regras de execução

1. Ler arquivo real antes de escrever doc.
2. Frontmatter obrigatório (`title/topic/kind/audience/updated/summary/code_refs/related_docs`).
3. Cada doc de feature: rotas, componentes, hooks, edges, tabelas, policies, invariantes, bugs conhecidos.
4. `updated` = data ISO da edição.
5. Ao encerrar cada fase, marcar ✅ done + preencher `Data`.

## Notas

- A infra `docs-sync.mjs` / `docs/INDEX.json` mencionada na skill `docs-maintainer` **não existe** neste projeto — auditoria é feita manualmente via este arquivo.
- Total: **467 arquivos de código** vs **62 docs** hoje. Meta: cobertura ≥ 90% de arquivos com ao menos uma doc referenciando.

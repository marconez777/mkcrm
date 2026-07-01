
# Roadmap — Atualização Total da Documentação (F-DOC-FULL)

Objetivo: percorrer **cada arquivo do repositório**, comparar com a documentação existente em `docs/` e reescrever/criar docs para refletir 1:1 o estado real do código. Cada fase termina com `node scripts/docs-sync.mjs` e revisão de `docs/DRIFT.md`.

Base de trabalho: `docs/INDEX.json` (146 docs hoje), `docs/DRIFT.md`, skill `docs-maintainer`.

---

## Fase 0 — Baseline & instrumentação (0.5 dia)

- Rodar `node scripts/docs-sync.mjs` e salvar snapshot inicial do DRIFT.
- Gerar inventário completo:
  - `src/pages/**`, `src/components/**`, `src/hooks/**`, `src/lib/**`
  - `supabase/functions/**` (edge functions + `_shared`)
  - migrations, tabelas (via `supabase--read_query`)
  - crons ativos (`cron.job`)
- Criar `docs/_audit/INVENTORY.md` cruzando: arquivo → doc atual → status (ok / stale / missing).
- Criar `docs/_audit/PROGRESS.md` (checklist vivo por fase).

## Fase 1 — Núcleo Frontend: rotas, shell, auth (1 dia)

Arquivos: `src/App.tsx`, `main.tsx`, `AppShell`, `AdminShell`, `ProtectedRoute`, `RootGate`, `FeatureRoute`, `ClinicOnlyRoute`, `useAuth`, `hooks/useRegion`, `i18n/*`, `lib/app-url.ts`, `lib/supabase-env.ts`.

Docs: atualizar/criar `docs/frontend/ROUTING.md`, `docs/frontend/SHELL.md`, `docs/frontend/AUTH.md`, `docs/frontend/I18N.md`, `docs/frontend/REGION.md`.

## Fase 2 — Inbox + Kanban + Leads (1.5 dias)

Arquivos: `src/pages/Inbox.tsx`, `Kanban.tsx`, `LeadDrawer.tsx`, `components/inbox/**`, `components/kanban/**`, `components/lead/**`, `hooks/useCrm.ts`, `useLeadsPaginated.ts`, `useLeadSearch.ts`, `lib/manual-stage-move.ts`, `delete-lead.ts`, `internal-notes.ts`, `lead-tasks.ts`.

Docs: `docs/maps/INBOX.md`, `docs/maps/KANBAN.md`, `docs/maps/LEADS.md` (+ subdocs jornada/timeline/tasks).

## Fase 3 — Pipeline runtime (edge + shared) (2 dias)

Arquivos: `supabase/functions/pipeline-*` (classify, deterministic, position-auditor, post-move-verifier, summarize, payment-webhook, run-executor, auto-retry, monthly-cycle-or, evals-run, tick), `_shared/pipeline-*.ts`, `_shared/stage-bindings.ts`, `_shared/agent-flags.ts`, `_shared/metrics.ts`.

Docs: reescrever tudo em `docs/pipeline/runtime/*` linha-a-linha (CLASSIFIER, DETERMINISTIC_RULES, AUDITORS, SUMMARIZER, GATES, FLOW_MATRIX, TRIGGERS_AUDIT, KNOWN_ISSUES). Comparar com `docs/pipeline/` (planejamento) e marcar divergências.

## Fase 4 — Agentes IA & IA Hub (1 dia)

Arquivos: `src/pages/Agents.tsx`, `ai/*`, `components/agents/**`, `pages/ai/**`, edge `ai-*` (auto-reply, chat, embed, ingest-*, assist, analyst-run, builder), `_shared/builder-knowledge/*`.

Docs: `docs/agents/*` (Atendimento, Roadmap, Training), `docs/ai/BUILDER.md`, `docs/ai/AUTO_REPLY.md`, `docs/ai/RAG.md`, `docs/ai/COSTS.md`.

## Fase 5 — WhatsApp / Evolution / Broadcasts (1 dia)

Arquivos: `evolution-*`, `whatsapp-*`, `broadcast-*`, `pages/Broadcasts.tsx`, `WhatsAppQrDialog`, `hooks/useWhatsappInstances`, `lib/broadcast-template.ts`.

Docs: `docs/maps/WHATSAPP.md`, `docs/maps/BROADCASTS.md`, `docs/pipeline/runtime/WEBHOOK_EVOLUTION.md`.

## Fase 6 — Automações, Sequências, Templates, Tarefas (1 dia)

Arquivos: `automations-tick`, `sequence-*`, `pages/Automations.tsx`, `Sequences.tsx`, `Templates.tsx`, `Tasks.tsx`, `components/tasks/**`, `agent-followups-tick`.

Docs: `docs/maps/AUTOMATIONS.md`, `SEQUENCES.md`, `TEMPLATES.md`, `TASKS.md`.

## Fase 7 — Email Marketing (1 dia)

Arquivos: `pages/email/**`, `components/email/**`, edges `send-email`, `email-*`, `resend-webhook`, `lib/email/**`.

Docs: `docs/features/EMAIL_*`, mapas por página.

## Fase 8 — Tracking, Formulários, Métricas (0.5 dia)

Arquivos: `tracking-*` edges, `pages/Tracking*`, `MetricsAiUsage`, `MetricsOps`, `MetricsEngagement`, `form_*` tabelas.

Docs: `docs/maps/TRACKING.md`, `METRICS.md`, `FORMS.md`.

## Fase 9 — Billing / Pagamentos / Planos (0.5 dia)

Arquivos: `create-checkout`, `create-portal-session`, `payments-webhook`, `eduzz-webhook`, `pages/Billing.tsx`, `Checkout*`, `lib/plans.ts`, `stripe.ts`, `hooks/useSubscription.ts`.

Docs: `docs/features/BILLING.md`, `PLANS.md`, `STRIPE.md`, `EDUZZ.md`.

## Fase 10 — Admin / Suporte / Observabilidade (0.5 dia)

Arquivos: `pages/admin/**`, `components/admin/**`, `SupportPanel`, `support-*` edges, `builder_manual_versions`.

Docs: `docs/admin/*`, `docs/support/*` (respeitando templates).

## Fase 11 — Site marketing + Proposal `/apn` (0.5 dia)

Arquivos: `pages/site/**`, `components/site/**`, `components/proposal/**`, `pages/Apn.tsx`.

Docs: `docs/marketing/SITE.md`, `docs/marketing/PROPOSAL.md`.

## Fase 12 — Banco: schema, RLS, funções, crons, secrets (1 dia)

Via `supabase--read_query`: dump completo de tabelas, colunas, policies, triggers, funções, crons, storage buckets.

Docs: reescrever `docs/database/SCHEMA.md`, `RLS_POLICIES.md`, `FUNCTIONS.md`, `CRONS.md`, `STORAGE.md`, `SECRETS.md`.

## Fase 13 — i18n & Multi-região (0.5 dia)

Comparar `docs/i18n/*` com `lib/region.ts`, `_shared/region.ts`, locales, clinics.region.

## Fase 14 — Consolidação final (0.5 dia)

- Rodar `docs-sync --check` — zerar quebras em `code_refs`.
- Reescrever `docs/README.md` como índice mestre.
- Atualizar `mem://index.md` e `mem://docs/maintenance-progress`.
- Gerar `docs/_audit/FINAL_REPORT.md` com: cobertura arquivo→doc, débitos remanescentes, invariantes catalogadas.

---

## Regras de execução (todas as fases)

1. Ler arquivo real antes de escrever doc — nunca inferir.
2. Frontmatter obrigatório (`title/topic/kind/audience/updated/summary/code_refs/related_docs`).
3. Cada doc de feature lista: rotas, componentes, hooks, edges, tabelas, policies, invariantes, bugs conhecidos.
4. `updated` = data da edição.
5. Rodar `docs-sync.mjs` ao fim de cada fase e commitar `INDEX.json` regenerado.
6. Registrar progresso em `docs/_audit/PROGRESS.md` (arquivo por arquivo).

## Entregáveis totais estimados

- ~40–60 docs novas/reescritas.
- 3 relatórios de auditoria (`INVENTORY`, `PROGRESS`, `FINAL_REPORT`).
- DRIFT.md zerado.
- Tempo total: ~11 dias de trabalho focado.

Confirma que sigo por essa ordem (Fase 0 → 14)? Se quiser priorizar alguma área (ex: pipeline primeiro, ou banco primeiro), me diz e reordeno.

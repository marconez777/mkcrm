---
title: "Inventário Código × Documentação (F-DOC-FULL)"
topic: general
kind: reference
audience: agent
updated: 2026-07-01
summary: "Cruzamento de cada arquivo de código-fonte e edge function com a documentação existente. Base para o roadmap F-DOC-FULL."
---

# Inventário — Código × Docs

Snapshot inicial: **467 arquivos de código** (`src/**` + `supabase/functions/**`) × **62 docs** em `docs/`.

Legenda de status:
- ✅ **ok** — doc atual reflete o código
- ⚠️ **stale** — doc existe mas está desatualizada
- ❌ **missing** — sem cobertura documental

> Este arquivo é preenchido incrementalmente durante F-DOC-FULL. Cada fase marca os arquivos que auditou.

## Fase 1 — Núcleo Frontend

| Arquivo | Doc atual | Status |
|---|---|---|
| `src/App.tsx` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/main.tsx` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/components/AppShell.tsx` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/layouts/AdminShell.tsx` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/components/ProtectedRoute.tsx` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/components/RootGate.tsx` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/components/FeatureRoute.tsx` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/components/ClinicOnlyRoute.tsx` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/hooks/useAuth.tsx` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/hooks/useRegion.ts` | `docs/maps/FRONTEND_CORE.md` + `docs/i18n/REGION_CONFIG.md` | ✅ |
| `src/i18n/**` | `docs/maps/FRONTEND_CORE.md` + `docs/i18n/*` | ✅ |
| `src/lib/features.ts` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/lib/region.ts` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/lib/app-url.ts` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/lib/supabase-env.ts` | `docs/maps/FRONTEND_CORE.md` | ✅ |
| `src/pages/Auth.tsx` | `docs/maps/FRONTEND_CORE.md` | ✅ |

## Fase 2 — Inbox / Kanban / Leads

Auditados em `docs/maps/INBOX_KANBAN_LEADS.md` (2026-07-01):

- Páginas: `src/pages/{Inbox,Kanban,LeadDrawer}.tsx` — ✅
- Componentes: `src/components/inbox/**` (12), `src/components/kanban/**` (14 + `calendar/`), `src/components/lead/**` (2 + `timeline/`), `src/components/leads/LeadAttributionCard.tsx` — ✅
- Hooks: `useCrm`, `useLeadsPaginated`, `useLeadSearch`, `useCustomFieldDefs`, `useAttendants`, `usePipelines`, `useWhatsappInstances`, `useQuickReplies`, `useHorizontalScroll`, `useWaAvatar` — ✅
- Libs: `manual-stage-move`, `internal-notes`, `lead-tasks`, `delete-lead`, `drafts`, `scheduled-messages`, `pipeline-skip-reasons`, `saved-views` — ✅
- Tipos: `src/types/crm.ts` — ✅ (subset relevante mapeado)

Dívidas registradas: `LeadAttributionCard` só citado (detalhar em Fase 8 Tracking); `Kanban.tsx`/`ChatPane.tsx`/`ContextRail.tsx` são candidatos a split; `useCrm.useLeads()` sem paginação (escala mal).

## Fase 3 — Pipeline runtime

Auditados em `docs/maps/PIPELINE_RUNTIME.md` (2026-07-01, hub navegacional):

- Edges (11): `pipeline-classify` (+`index.v1.ts`), `pipeline-deterministic`, `pipeline-run-executor`, `pipeline-auto-retry`, `pipeline-summarize`, `pipeline-position-auditor` (A1), `pipeline-post-move-verifier` (A2), `pipeline-monthly-cycle-or`, `pipeline-payment-webhook`, `pipeline-queue-alert`, `pipeline-evals-run` — ✅
- Shared: `pipeline-move.ts`, `pipeline-tasks.ts`, `pipeline-summarize-core.ts`, `pipeline-fase4.ts`, `pipeline-allowlist.ts`, `ai-pipeline-filter.ts`, `stage-bindings.ts`, `agent-flags.ts`, `metrics.ts` — ✅
- Docs detalhadas revalidadas: 20 arquivos em `docs/pipeline/runtime/` — ✅ (cruzados linha-a-linha com código real; sem drift crítico).

Dívidas registradas: `stage_sequence_bindings` dormente; `pipeline-deterministic` (1017 LOC) candidato a split; `pipeline-monthly-cycle-or` hardcoded para Clínica ÓR; V1 do classifier mantido só como rollback.



## Fase 4 — Agentes IA & IA Hub

Auditados em `docs/maps/AI_AGENTS.md` (2026-07-01):

- Edges (18): `ai-chat`, `ai-auto-reply`, `ai-builder`, `ai-assist`, `ai-analyst-run`, `ai-embed`, `ai-eval-run`, `ai-ingest-{document,pdf,url,urls}`, `ai-reingest-document`, `ai-spend-notify`, `agent-{create,followups-tick,learn-from-thread,run-bulk}`, `transcribe-audio` — ✅
- Shared: `ai.ts`, `rag.ts`, `mcp.ts`, `spend-guard.ts`, `builder-system-prompt.ts`, `builder-knowledge/`, `agent-flags.ts`, `ai-pricing.ts`, `classifier-ai.ts`, `clinic-openai.ts`, `lovable-ai.ts` — ✅
- Páginas: `pages/ai/{AiHub,AiDashboard,AgentWizard,Messages}.tsx`, `Agents.tsx`, `AgentMemories.tsx`, `AiInsights.tsx`, `MetricsAiUsage.tsx` — ✅
- Componentes: `components/agents/**` (15), `components/ai/usage/**` (2) — ✅
- Lib front: `src/lib/agent-tools.ts`, `src/lib/ai-pricing.ts` — ✅
- Docs prévias mantidas: `docs/agents/{FEBRACIS_ATENDIMENTO,FEBRACIS_PRI,FEBRACIS_ROADMAP,TRAINING_FRAMEWORK}.md`

Dívidas registradas: `ai-chat` (912 LOC) e `ai-builder` (1561 LOC) candidatos a split; falta doc própria de MCP, RAG, TestLab, `transcribe-audio`, spend-limits; `agent-followups-tick` ignora TZ da clínica; sem circuit-breaker por agente; `pending_replies` sem cleanup.



## Fase 5 — WhatsApp / Evolution / Broadcasts

Edges: `evolution-*` (16 funções), `broadcast-{control,tick}`, `dispatch-campaign`, `process-scheduled-campaigns`, `scheduled-dispatcher`, `wa-redirect`, `fetch-wa-avatar`.
Páginas: `Broadcasts.tsx`. Componentes: `components/settings/WhatsAppQrDialog.tsx`.

Docs: `docs/pipeline/runtime/WEBHOOK_EVOLUTION.md` (parcial). Status: ❌ **missing** — criar `docs/maps/WHATSAPP.md`, `BROADCASTS.md`, `EVOLUTION_EDGES.md`.

## Fase 6 — Automações / Sequências / Templates / Tarefas

Edges: `automations-tick`, `sequence-{trigger,tick,enroll}`, `agent-followups-tick`, `outreach-recovery-tick`, `watch-stale-leads`, `dedup-leads-tick`.
Páginas: `Automations.tsx`, `Sequences.tsx`, `Templates.tsx`, `Tasks.tsx`.
Componentes: `components/tasks/**`.

Docs: nenhum mapa. Status: ❌ **missing**.

## Fase 7 — Email Marketing

Páginas: `pages/email/**` (14 arquivos).
Componentes: `components/email/**`.
Lib: `src/lib/email/**`.
Edges: `send-email`, `send-email-batch`, `email-automations-tick`, `email-domain-manage`, `email-unsubscribe`, `process-email-queue`, `resend-webhook`, `backfill-resend-events`.

Docs: nenhum. Status: ❌ **missing** — bloco inteiro `docs/features/EMAIL_*`.

## Fase 8 — Tracking / Formulários / Métricas

Edges: `tracking-{config,event,pixel,identify}`, `track-event`, `forms-{admin,ingest,plugin-zip,snippet}`, `external-lead-capture`, `scheduled-report-tick`, `daily-summary`, `report-finalizados-mensal-or`.
Páginas: `Tracking.tsx`, `TrackingDebug.tsx`, `SettingsForms.tsx`, `Metrics*.tsx` (4), `ScheduledReports.tsx`, `pages/tracking/**`.

Docs: nenhum. Status: ❌ **missing**.

## Fase 9 — Billing / Pagamentos

Edges: `create-checkout`, `create-portal-session`, `payments-webhook`, `eduzz-webhook`, `admin-{apply-plan,invoice,revoke-plan}`, `cron-expire-manual-grants`.
Páginas: `Billing.tsx`, `Checkout.tsx`, `CheckoutReturn.tsx`, `admin/AdminEduzz.tsx`.
Lib: `plans.ts`, `stripe.ts`, `admin-plans.ts`.

Docs: nenhum. Status: ❌ **missing**.

## Fase 10 — Admin / Suporte / Observabilidade

Páginas: `pages/admin/**` (10 arquivos).
Componentes: `components/admin/**` (20 arquivos), `components/support/**`.
Edges: `support-{admin-reply,chat,kb-status,kb-sync,test-connection}`, `log-frontend-error`, `integrations-status`, `admin-*`, `auth-login`, `clinic-{create-user,invite,openai-key}`, `admin-delete-clinic`, `admin-user-action`, `admin-users-list`.

Docs: `docs/clinics/COMPARATIVO.md` (parcial). Status: ⚠️/❌.

## Fase 11 — Site marketing + Proposal

Páginas: `pages/site/MarketingSite.tsx`, `pages/Apn.tsx`, `pages/Index.tsx`.
Componentes: `components/site/**` (13), `components/proposal/**`.

Docs: nenhum. Status: ❌ **missing**.

## Fase 12 — Banco

Tabelas: **135** (ver `<supabase-tables>`).
Storage buckets: `estudo-cache` (+ outros a auditar).
Cron jobs: a listar via `cron.job`.

Docs: `docs/pipeline/runtime/DATABASE_LIVE.md` (só pipeline). Status: ❌ **missing** — criar `docs/database/{SCHEMA,RLS_POLICIES,FUNCTIONS,CRONS,STORAGE,SECRETS}.md`.

## Fase 13 — i18n / Multi-região

Arquivos: `src/i18n/**`, `src/lib/region.ts`, `src/hooks/useRegion.ts`, `supabase/functions/_shared/region.ts`.

Docs existentes: `docs/i18n/{ROADMAP,REGION_CONFIG,IMPORT_TEMPLATES,TRANSLATION_PROCESS,COMPLIANCE}.md`. Status: ⚠️ **stale** — verificar sincronia com F-INTL-4 (Stripe multi-currency já implementado).

## Fase 14 — Consolidação final

- Reescrever `docs/README.md` como índice mestre.
- Gerar `docs/_audit/FINAL_REPORT.md`.
- Atualizar `mem://index.md`.

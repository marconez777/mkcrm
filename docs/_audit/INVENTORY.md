---
title: "InventÃ¡rio CÃ³digo Ã— DocumentaÃ§Ã£o (F-DOC-FULL)"
topic: general
kind: reference
audience: agent
updated: 2026-07-01
summary: "Cruzamento de cada arquivo de cÃ³digo-fonte e edge function com a documentaÃ§Ã£o existente. Base para o roadmap F-DOC-FULL."
---

# InventÃ¡rio â€” CÃ³digo Ã— Docs

Snapshot inicial: **467 arquivos de cÃ³digo** (`src/**` + `supabase/functions/**`) Ã— **62 docs** em `docs/`.

Legenda de status:
- âœ… **ok** â€” doc atual reflete o cÃ³digo
- âš ï¸ **stale** â€” doc existe mas estÃ¡ desatualizada
- âŒ **missing** â€” sem cobertura documental

> Este arquivo Ã© preenchido incrementalmente durante F-DOC-FULL. Cada fase marca os arquivos que auditou.

## Fase 1 â€” NÃºcleo Frontend

| Arquivo | Doc atual | Status |
|---|---|---|
| `src/App.tsx` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/main.tsx` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/components/AppShell.tsx` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/layouts/AdminShell.tsx` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/components/ProtectedRoute.tsx` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/components/RootGate.tsx` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/components/FeatureRoute.tsx` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/components/ClinicOnlyRoute.tsx` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/hooks/useAuth.tsx` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/hooks/useRegion.ts` | `docs/maps/FRONTEND_CORE.md` + `docs/i18n/REGION_CONFIG.md` | âœ… |
| `src/i18n/**` | `docs/maps/FRONTEND_CORE.md` + `docs/i18n/*` | âœ… |
| `src/lib/features.ts` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/lib/region.ts` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/lib/app-url.ts` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/lib/supabase-env.ts` | `docs/maps/FRONTEND_CORE.md` | âœ… |
| `src/pages/Auth.tsx` | `docs/maps/FRONTEND_CORE.md` | âœ… |

## Fase 2 â€” Inbox / Kanban / Leads

Auditados em `docs/maps/INBOX_KANBAN_LEADS.md` (2026-07-01):

- PÃ¡ginas: `src/pages/{Inbox,Kanban,LeadDrawer}.tsx` â€” âœ…
- Componentes: `src/components/inbox/**` (12), `src/components/kanban/**` (14 + `calendar/`), `src/components/lead/**` (2 + `timeline/`), `src/components/leads/LeadAttributionCard.tsx` â€” âœ…
- Hooks: `useCrm`, `useLeadsPaginated`, `useLeadSearch`, `useCustomFieldDefs`, `useAttendants`, `usePipelines`, `useWhatsappInstances`, `useQuickReplies`, `useHorizontalScroll`, `useWaAvatar` â€” âœ…
- Libs: `manual-stage-move`, `internal-notes`, `lead-tasks`, `delete-lead`, `drafts`, `scheduled-messages`, `pipeline-skip-reasons`, `saved-views` â€” âœ…
- Tipos: `src/types/crm.ts` â€” âœ… (subset relevante mapeado)

DÃ­vidas registradas: `LeadAttributionCard` sÃ³ citado (detalhar em Fase 8 Tracking); `Kanban.tsx`/`ChatPane.tsx`/`ContextRail.tsx` sÃ£o candidatos a split; `useCrm.useLeads()` sem paginaÃ§Ã£o (escala mal).

## Fase 3 â€” Pipeline runtime

Auditados em `docs/maps/PIPELINE_RUNTIME.md` (2026-07-01, hub navegacional):

- Edges (11): `pipeline-classify` (+`index.v1.ts`), `pipeline-deterministic`, `pipeline-run-executor`, `pipeline-auto-retry`, `pipeline-summarize`, `pipeline-position-auditor` (A1), `pipeline-post-move-verifier` (A2), `pipeline-monthly-cycle-or`, `pipeline-payment-webhook`, `pipeline-queue-alert`, `pipeline-evals-run` â€” âœ…
- Shared: `pipeline-move.ts`, `pipeline-tasks.ts`, `pipeline-summarize-core.ts`, `pipeline-fase4.ts`, `pipeline-allowlist.ts`, `ai-pipeline-filter.ts`, `stage-bindings.ts`, `agent-flags.ts`, `metrics.ts` â€” âœ…
- Docs detalhadas revalidadas: 20 arquivos em `docs/pipeline/runtime/` â€” âœ… (cruzados linha-a-linha com cÃ³digo real; sem drift crÃ­tico).

DÃ­vidas registradas: `stage_sequence_bindings` dormente; `pipeline-deterministic` (1017 LOC) candidato a split; `pipeline-monthly-cycle-or` hardcoded para ClÃ­nica Ã“R; V1 do classifier mantido sÃ³ como rollback.



## Fase 4 â€” Agentes IA & IA Hub

Auditados em `docs/maps/AI_AGENTS.md` (2026-07-01):

- Edges (18): `ai-chat`, `ai-auto-reply`, `ai-builder`, `ai-assist`, `ai-analyst-run`, `ai-embed`, `ai-eval-run`, `ai-ingest-{document,pdf,url,urls}`, `ai-reingest-document`, `ai-spend-notify`, `agent-{create,followups-tick,learn-from-thread,run-bulk}`, `transcribe-audio` â€” âœ…
- Shared: `ai.ts`, `rag.ts`, `mcp.ts`, `spend-guard.ts`, `builder-system-prompt.ts`, `builder-knowledge/`, `agent-flags.ts`, `ai-pricing.ts`, `classifier-ai.ts`, `clinic-openai.ts`, `lovable-ai.ts` â€” âœ…
- PÃ¡ginas: `pages/ai/{AiHub,AiDashboard,AgentWizard,Messages}.tsx`, `Agents.tsx`, `AgentMemories.tsx`, `AiInsights.tsx`, `MetricsAiUsage.tsx` â€” âœ…
- Componentes: `components/agents/**` (15), `components/ai/usage/**` (2) â€” âœ…
- Lib front: `src/lib/agent-tools.ts`, `src/lib/ai-pricing.ts` â€” âœ…
- Docs prÃ©vias mantidas: `docs/agents/{FEBRACIS_ATENDIMENTO,FEBRACIS_PRI,FEBRACIS_ROADMAP,TRAINING_FRAMEWORK}.md`

DÃ­vidas registradas: `ai-chat` (912 LOC) e `ai-builder` (1561 LOC) candidatos a split; falta doc prÃ³pria de MCP, RAG, TestLab, `transcribe-audio`, spend-limits; `agent-followups-tick` ignora TZ da clÃ­nica; sem circuit-breaker por agente; `pending_replies` sem cleanup.



## Fase 5 â€” WhatsApp / Evolution / Broadcasts

Edges: `evolution-*` (16 funÃ§Ãµes), `broadcast-{control,tick}`, `dispatch-campaign`, `process-scheduled-campaigns`, `scheduled-dispatcher`, `wa-redirect`, `fetch-wa-avatar`.
PÃ¡ginas: `Broadcasts.tsx`. Componentes: `components/settings/WhatsAppQrDialog.tsx`.

Docs: `docs/evolution/WEBHOOK_EVOLUTION.md` (parcial). Status: âŒ **missing** â€” criar `docs/evolution/WHATSAPP.md`, `BROADCASTS.md`, `EVOLUTION_EDGES.md`.

## Fase 6 â€” AutomaÃ§Ãµes / SequÃªncias / Templates / Tarefas

Edges: `automations-tick`, `sequence-{trigger,tick,enroll}`, `agent-followups-tick`, `outreach-recovery-tick`, `watch-stale-leads`, `dedup-leads-tick`.
PÃ¡ginas: `Automations.tsx`, `Sequences.tsx`, `Templates.tsx`, `Tasks.tsx`.
Componentes: `components/tasks/**`.

Docs: nenhum mapa. Status: âŒ **missing**.

## Fase 7 â€” Email Marketing

PÃ¡ginas: `pages/email/**` (14 arquivos).
Componentes: `components/email/**`.
Lib: `src/lib/email/**`.
Edges: `send-email`, `send-email-batch`, `email-automations-tick`, `email-domain-manage`, `email-unsubscribe`, `process-email-queue`, `resend-webhook`, `backfill-resend-events`.

Docs: nenhum. Status: âŒ **missing** â€” bloco inteiro `docs/features/EMAIL_*`.

## Fase 8 â€” Tracking / FormulÃ¡rios / MÃ©tricas

Edges: `tracking-{config,event,pixel,identify}`, `track-event`, `forms-{admin,ingest,plugin-zip,snippet}`, `external-lead-capture`, `scheduled-report-tick`, `daily-summary`, `report-finalizados-mensal-or`.
PÃ¡ginas: `Tracking.tsx`, `TrackingDebug.tsx`, `SettingsForms.tsx`, `Metrics*.tsx` (4), `ScheduledReports.tsx`, `pages/tracking/**`.

Docs: nenhum. Status: âŒ **missing**.

## Fase 9 â€” Billing / Pagamentos

Edges: `create-checkout`, `create-portal-session`, `payments-webhook`, `eduzz-webhook`, `admin-{apply-plan,invoice,revoke-plan}`, `cron-expire-manual-grants`.
PÃ¡ginas: `Billing.tsx`, `Checkout.tsx`, `CheckoutReturn.tsx`, `admin/AdminEduzz.tsx`.
Lib: `plans.ts`, `stripe.ts`, `admin-plans.ts`.

Docs: nenhum. Status: âŒ **missing**.

## Fase 10 â€” Admin / Suporte / Observabilidade

PÃ¡ginas: `pages/admin/**` (10 arquivos).
Componentes: `components/admin/**` (20 arquivos), `components/support/**`.
Edges: `support-{admin-reply,chat,kb-status,kb-sync,test-connection}`, `log-frontend-error`, `integrations-status`, `admin-*`, `auth-login`, `clinic-{create-user,invite,openai-key}`, `admin-delete-clinic`, `admin-user-action`, `admin-users-list`.

Docs: `docs/clinics/COMPARATIVO.md` (parcial). Status: âš ï¸/âŒ.

## Fase 11 â€” Site marketing + Proposal

PÃ¡ginas: `pages/site/MarketingSite.tsx`, `pages/Apn.tsx`, `pages/Index.tsx`.
Componentes: `components/site/**` (13), `components/proposal/**`.

Docs: nenhum. Status: âŒ **missing**.

## Fase 12 â€” Banco

Tabelas: **135** (ver `<supabase-tables>`).
Storage buckets: `estudo-cache` (+ outros a auditar).
Cron jobs: a listar via `cron.job`.

Docs: `docs/pipeline/runtime/DATABASE_LIVE.md` (sÃ³ pipeline). Status: âŒ **missing** â€” criar `docs/database/{SCHEMA,RLS_POLICIES,FUNCTIONS,CRONS,STORAGE,SECRETS}.md`.

## Fase 13 â€” i18n / Multi-regiÃ£o

Arquivos: `src/i18n/**`, `src/lib/region.ts`, `src/hooks/useRegion.ts`, `supabase/functions/_shared/region.ts`.

Docs existentes: `docs/i18n/{ROADMAP,REGION_CONFIG,IMPORT_TEMPLATES,TRANSLATION_PROCESS,COMPLIANCE}.md`. Status: âš ï¸ **stale** â€” verificar sincronia com F-INTL-4 (Stripe multi-currency jÃ¡ implementado).

## Fase 14 â€” ConsolidaÃ§Ã£o final

- Reescrever `docs/README.md` como Ã­ndice mestre.
- Gerar `docs/_audit/FINAL_REPORT.md`.
- Atualizar `mem://index.md`.

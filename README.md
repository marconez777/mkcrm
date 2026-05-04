# CRM WhatsApp (Evolution API) + IA

CRM com Inbox em tempo real, pipelines Kanban múltiplos, agentes de IA com RAG, automações e métricas. Integrado ao WhatsApp via Evolution API. Construído com React + Vite + Tailwind + shadcn/ui no frontend e Lovable Cloud (Supabase: Postgres + Edge Functions + Realtime + Auth) no backend.

## Documentação

- **Manual do usuário:** [`docs/MANUAL.md`](docs/MANUAL.md)
- **Arquitetura:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Modelo de dados:** [`docs/DATABASE.md`](docs/DATABASE.md)
- **Edge Functions:** [`docs/EDGE_FUNCTIONS.md`](docs/EDGE_FUNCTIONS.md)
- **Integração Evolution / WhatsApp:** [`docs/EVOLUTION.md`](docs/EVOLUTION.md)
- **Módulo de IA (agentes + RAG + auto-reply):** [`docs/AI.md`](docs/AI.md)
- **Automações:** [`docs/AUTOMATIONS.md`](docs/AUTOMATIONS.md)
- **Autenticação:** [`docs/AUTH.md`](docs/AUTH.md)

## Stack
- React 18 · Vite 5 · TypeScript · TailwindCSS · shadcn/ui · @dnd-kit · TanStack Query · React Router
- Supabase (Postgres + pgvector, Realtime, Edge Functions Deno, Auth)
- Evolution API (WhatsApp)
- Lovable AI Gateway (modelos Google/OpenAI sem API key) + provedores externos opcionais

## Scripts
```bash
bun install       # dependências
bun run dev       # desenvolvimento
bun run build     # build de produção
bun run test      # testes (vitest)
bun run lint
```

## Módulos principais

| Módulo | Páginas / pastas | Descrição |
|---|---|---|
| Inbox | `pages/Inbox.tsx`, `components/inbox/*` | Conversas em tempo real, notas internas, encaminhamento, agendamento, tarefas. |
| Kanban | `pages/Kanban.tsx`, `components/kanban/*` | Pipelines múltiplos (sales/internal), drag de cards, pan horizontal do board. |
| IA | `pages/Agents.tsx`, `supabase/functions/ai-*` | Agentes com RAG (pgvector), threads, auto-reply, MCP, evals. |
| Automações | `pages/Automations.tsx`, `automations-tick` | Gatilhos baseados em eventos do CRM. |
| Tarefas | `pages/Tasks.tsx`, `lib/lead-tasks.ts` | To-dos vinculados a leads, com vencimento. |
| Templates | `pages/Templates.tsx` | Mensagens com variáveis e atalhos. |
| Métricas | `pages/Metrics.tsx`, `pages/MetricsOps.tsx` | KPIs de atendimento e operação. |
| Settings | `pages/Settings.tsx`, `pages/SettingsCustomFields.tsx` | Instâncias WhatsApp, atendentes, respostas rápidas, campos customizados. |

## Estrutura
```
src/
  pages/                Inbox, Kanban, Agents, Automations, Tasks, Templates,
                        Metrics, MetricsOps, Settings, SettingsCustomFields,
                        LeadDrawer, Auth
  components/
    inbox/              ChatPane, ConversationList, Composer, ContextRail,
                        CustomFieldsPanel, ForwardDialog, LeadTasksPanel,
                        ScheduleMessageDialog, ScheduledMessagesPanel,
                        TaskDialog, NewConversationDialog
    kanban/             PipelineSidebar, PipelineSwitcher, PipelineOverview,
                        TopScrollbar, EditStageDialog, NewPipelineDialog
    ui/                 shadcn/ui primitives
  hooks/                useCrm, useAuth, usePipelines, useAttendants,
                        useQuickReplies, useHealth, useUnreadTitle,
                        useHorizontalScroll, useLeadsPaginated, useWaAvatar
  lib/                  drafts, internal-notes, lead-tasks, saved-views,
                        scheduled-messages, supabase-env, utils
  integrations/supabase/  client + types (auto-gerados)
supabase/
  functions/
    _shared/            evolution.ts, ai.ts, rag.ts, mcp.ts, metrics.ts,
                        utils.ts, types.ts
    evolution-*         webhook, send, sync-lead, health, test, backfill-all
    ai-*                assist, auto-reply, chat, embed, eval-run,
                        ingest-document, ingest-pdf, ingest-url, ingest-urls
    automations-tick
    scheduled-dispatcher
    fetch-wa-avatar
    transcribe-audio
  config.toml
```

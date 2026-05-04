# Arquitetura

## Visão geral

```
┌────────────┐  WhatsApp   ┌──────────────┐  webhook   ┌──────────────────┐
│  Cliente   │ ──────────► │ Evolution API│ ─────────► │ evolution-webhook│
└────────────┘             └──────────────┘            └────────┬─────────┘
                                  ▲                             │ ingest (idempotente)
                                  │ REST                        ▼
                            ┌────────────┐               ┌──────────────┐
                            │evolution-  │ ◄──────────── │  Postgres    │
                            │   send     │               │  + pgvector  │
                            └────────────┘               └──┬────────┬──┘
                                                            │        │
                       ┌────────────────────────────────────┘        │ Realtime
                       │ trigger / cron                              ▼
                       ▼                                       ┌─────────────┐
              ┌─────────────────┐  ai-auto-reply / ai-chat     │  React UI   │
              │ automations-tick│ ──────────► Lovable AI ◄──── │ (Inbox/Kbn/ │
              │ scheduled-disp. │             Gateway          │  Agents)    │
              └─────────────────┘                              └─────────────┘
```

## Camadas

### Frontend (`src/`)
- **Roteamento** (`App.tsx`): `/` Kanban, `/inbox[/:leadId]`, `/agents`, `/automations`, `/tasks`, `/templates`, `/metrics`, `/metrics/ops`, `/settings`, `/settings/custom-fields`, `/auth`.
- **Auth**: `useAuth` + `ProtectedRoute` em volta de toda área autenticada. Login com email/senha via Supabase Auth.
- **Estado de servidor**: hooks Realtime customizados (`useCrm`, `usePipelines`, `useAttendants`, `useQuickReplies`) mantêm cache local incremental — sem refetch global.
- **TanStack Query**: usado em listas paginadas (`useLeadsPaginated`) e fetches pontuais.
- **DnD vs Pan**: `Kanban.tsx` usa um `CardOnlyPointerSensor` customizado para o `dnd-kit` que só ativa em `[data-kanban-card]`, liberando o fundo do board para o `useHorizontalScroll`.
- **Design system**: tokens HSL em `src/index.css` + `tailwind.config.ts`. Componentes shadcn/ui.

### Backend (Lovable Cloud / Supabase)
- **Postgres + pgvector**: tabelas em [DATABASE.md](DATABASE.md). RLS com policy `authenticated_all` (usuários logados acessam tudo — single-tenant interno).
- **Edge Functions** (Deno): ver [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md). Agrupadas em três famílias:
  - `evolution-*`: integração WhatsApp.
  - `ai-*`: LLM, RAG, auto-reply, ingestão.
  - `automations-tick`, `scheduled-dispatcher`, `transcribe-audio`, `fetch-wa-avatar`: jobs auxiliares.
- **Realtime**: WebSocket para `INSERT/UPDATE/DELETE` nas tabelas publicadas.
- **Cron**: `automations-tick` e `scheduled-dispatcher` rodam periodicamente.

### Integrações externas
- **Evolution API**: gateway WhatsApp baseado em Baileys.
- **Lovable AI Gateway**: provê modelos Google/OpenAI sem API key do usuário.
- **Provedores próprios**: cada `ai_agent` pode definir `provider`, `api_key`, `base_url`, `embedding_*` para usar OpenAI, Anthropic, Google diretamente.
- **MCP Servers**: agentes podem chamar ferramentas via Model Context Protocol (`agent_mcp_servers`, `_shared/mcp.ts`).

## Fluxos críticos

### Recebimento de mensagem
1. Evolution chama `POST /functions/v1/evolution-webhook?token=...` (`MESSAGES_UPSERT`).
2. `evolution-webhook` valida token, registra em `webhook_events`, deduplica via `webhook_dedup` e chama `ingestMessage`.
3. `ingestMessage` (em `_shared/evolution.ts`) é **idempotente**:
   - Resolve/cria lead pelo telefone (e instância de origem).
   - SELECT por `(lead_id, external_id)` antes de gravar.
   - Se nova → INSERT + `increment_unread` + preview.
4. Postgres dispara Realtime → UI atualiza chat e badge.
5. Se houver `lead_ai_settings.auto_reply = true` para o lead, é enfileirado `pending_replies` que `ai-auto-reply` consome após o `debounce_seconds` do agente.

### Envio de mensagem
1. UI gera `client_message_id` (UUID) e chama `evolution-send`.
2. Função insere `messages` com `status='pending'`.
3. POST em `/message/sendText/{instance}` da Evolution.
4. Atualiza `external_id` + `status='sent'`. Em falha → `status='failed'` + `last_error`.
5. `MESSAGES_UPDATE` posterior atualiza `delivery_status`.

### Auto-reply (IA)
1. Mensagem inbound chega → `evolution-webhook` ingere e dispara `ai-auto-reply` em fire-and-forget.
2. `ai-auto-reply` resolve agente (lead → estágio), checa `paused_until`/`enabled` e faz `upsert` em `pending_replies` com `run_at = now() + debounce_seconds`. Mensagens em sequência apenas estendem o `run_at` (debounce).
3. `scheduled-dispatcher` (cron ~1 min) reclama atomicamente as `pending_replies` vencidas, agrupa as últimas mensagens, chama `ai-chat` para gerar a resposta e envia via `evolution-send`.
4. Custos/tokens em `ai_usage`. Trace em `agent_traces` (via `log_agent_trace`).

### Mensagens agendadas
1. UI grava em `scheduled_messages` com `send_at` futuro e `status='pending'`.
2. Cron `scheduled-dispatcher` busca pendências vencidas, dispara `evolution-send` e atualiza `status='sent'`/`failed`.

### Automações
1. Usuário define regra em `automations` (gatilho + condições + ações).
2. Eventos do CRM (mudança de estágio, nova mensagem, etc.) são detectados pelo `automations-tick` (cron) que executa as ações pertinentes.
3. Cada execução grava em `automation_runs` com sucesso/erro.

### RAG (busca na base de conhecimento)
1. Documentos são ingeridos via `ai-ingest-*` → divididos em chunks (`chunkText`) → embeddings (`embed`) → gravados em `ai_chunks` com `vector` + `tsvector` (português).
2. Na consulta (`ai-chat`/auto-reply via dispatcher), o RAG (`_shared/rag.ts`) chama as RPCs `match_chunks` (vetorial) ou `match_chunks_hybrid` (vetorial + FTS com fusão RRF), com opção de **HyDE** e reranker.
3. `embedding_cache` e `rag_cache` evitam recomputo. Limpeza periódica via `cleanup_agent_caches()`.

## Decisões de design

- **Idempotência no servidor** (webhook + sync + dedup) simplifica o cliente.
- **Realtime incremental** no cliente — patches em memória, sem refetch.
- **RLS `authenticated_all`** — single-tenant interno; multi-tenant exigirá `org_id` em todas as tabelas.
- **Lovable AI Gateway por padrão** — agentes funcionam sem usuário ter que cadastrar API key.
- **Múltiplas instâncias WhatsApp** — um pipeline pode estar amarrado a uma instância específica (`pipelines.whatsapp_instance_id`).

# Modelo de Dados

Schema `public`. RLS habilitada com policy `authenticated_all` (usuários logados via Supabase Auth acessam tudo). Para multi-tenant será preciso adicionar `org_id` + policies por organização.

Extensões: `pgvector` (embeddings), `pg_trgm`, `uuid-ossp`/`pgcrypto`.

## Núcleo do CRM

### `pipelines`
Pipelines múltiplos (cada um com seu Kanban).
- `id uuid pk`, `name`, `kind text` (`sales`|`internal`), `color`, `position int`, `is_default bool`.
- `whatsapp_instance_id uuid` → `whatsapp_instances` (instância default desse pipeline).
- Único parcial: apenas um `is_default = true`.

### `pipeline_stages`
Colunas do Kanban.
- `id`, `name`, `position int`, `color`, `pipeline_id` → `pipelines (cascade)`.

### `whatsapp_instances`
Múltiplas instâncias Evolution.
- `id`, `name`, `evolution_url`, `evolution_api_key`, `evolution_instance`.
- `webhook_token` (gerado, único), `connection_state`, `last_health_check`, `webhook_ok`, `webhook_last_set_at`, `webhook_last_error`, `last_poll_at`, `is_default bool`.

### `attendants`
- `id`, `name`, `color`.

### `leads`
- `id`, `phone unique`, `name`, `email`, `company`, `deal_value`, `notes`.
- `tags text[]`, `custom_fields jsonb`.
- `stage_id` → `pipeline_stages`, `pipeline_id` → `pipelines`, `attendant_id` → `attendants`, `position int`.
- `whatsapp_instance_id` → `whatsapp_instances`.
- `avatar_url`, `unread_count`, `last_message_at`, `last_message_preview`.
- `pinned_at`, `marked_unread`, `archived_at`.
- `ai_summary text`, `ai_summary_at`.
- `stage_changed_at`, `created_at`, `updated_at`.

### `messages`
- `id`, `lead_id`, `external_id`, `client_message_id` (idempotência envio).
- `from_me bool`, `message_type`, `content`, `media_url`, `media_mime`.
- `status` (`pending|sent|received|failed`), `delivery_status` (`sent|delivered|read`).
- `reply_to_external_id`, `raw jsonb`, `timestamp`, `retry_count`, `last_error`.
- Índice único: `(lead_id, external_id)`.

### `lead_events`
Auditoria — `type`, `payload jsonb`, gerado por trigger ao trocar `stage_id`/`attendant_id`.

### `lead_internal_notes`
Notas internas do time. `lead_id`, `author_id`, `author_name`, `text`, `created_at`.

### `lead_tasks`
- `lead_id`, `title`, `due_at`, `done_at`. Realtime habilitado.

### `lead_custom_fields`
Definição: `field_key`, `label`, `field_type` (`text|number|select|...`), `options jsonb`, `position`.

### `lead_reply_counters`
Rate-limit para auto-reply. Chave `(lead_id, hour_bucket)`, `count`, `last_bot_sent_at`.

### `lead_ai_settings`
Por lead: `agent_id`, `auto_reply bool`, `paused_until`.

### `quick_replies`
- `shortcut`, `content`.

### `message_templates`
Templates ricos. `name`, `shortcut`, `content`, `variables jsonb`, `description`.

### `scheduled_messages`
- `lead_id`, `content`, `send_at`, `status` (`pending|sent|failed`), `sent_at`, `last_error`. Realtime habilitado.

### `pending_replies`
Fila de auto-reply (debounce). `lead_id pk`, `agent_id`, `run_at`, payload de mensagens.

## Settings

### `settings` (linha única `id=1`)
Configuração legada (mantida para compatibilidade). Instância default movida para `whatsapp_instances`.

### `webhook_events`
Auditoria de chamadas Evolution: `event_type`, `source` (`webhook|sync|poll`), `payload`, `lead_id`, `received_at`, `processed_at`, `error`.

### `webhook_dedup`
Deduplicação curta (cache de event hashes para evitar retry-storm).

## Módulo IA

### `ai_agents`
Configuração de agentes.
- `name`, `description`, `system_prompt`, `model`, `temperature`, `enabled`, `tools jsonb`.
- `provider` (`openai|anthropic|google`), `api_key`, `base_url`.
- `embedding_model`, `embedding_api_key`.
- `reranker_provider`, `reranker_api_key`.
- `max_iterations`, `max_tool_calls`, `rag_top_k`, `debounce_seconds`.
- Flags: `use_hyde`, `use_hybrid_search`, `use_memory`, `planning_mode`.

### `ai_documents`
Fonte do RAG. `agent_id`, `title`, `source`, `content`, `metadata`, `doc_summary`.

### `ai_chunks`
Pedaços vetorizados.
- `document_id`, `agent_id`, `chunk_index`, `content`, `token_count`.
- `embedding vector(768)`, `tsv tsvector` (gerado, português).
- Índices: ivfflat para cosseno, GIN para FTS.

### `ai_threads` / `ai_messages`
Histórico de conversa do agente. `thread_id`, `role` (`system|user|assistant|tool`), `content`, `tool_calls`, `tool_call_id`.

### `agent_memory`
Memória de longo prazo do agente (summary/notas).

### `agent_mcp_servers`
Servidores MCP conectados ao agente.

### `agent_traces`
Trace passo-a-passo de execução (raciocínio, tool calls).

### `agent_evals`
Casos de teste e resultados.

### `stage_ai_defaults`
Agente default por estágio do pipeline.

### `ai_usage`
Telemetria/custos. `agent_id`, `automation_id`, `lead_id`, `thread_id`, `model`, tokens, custo.

### `embedding_cache`
Evita re-embeddar conteúdo já visto (chave por hash).

### `rag_cache`
Cache de respostas RAG por consulta.

## Automações

### `automations`
Regras: nome, trigger, condições, ações (jsonb), enabled.

### `automation_runs`
Histórico de execução com status, payload, erro.

## Funções

| Função | Descrição |
|---|---|
| `set_updated_at()` | Trigger genérica para `updated_at`. |
| `set_stage_changed_at()` | Atualiza `stage_changed_at` ao trocar `stage_id`. |
| `increment_unread(lead_id, preview, ts)` | Atomic +1 em `unread_count` + preview. |
| `log_lead_changes()` | Grava `lead_events` ao mudar `stage_id`/`attendant_id`. |
| `cleanup_webhook_events()` | Remove eventos > 14 dias (cron). |
| `match_chunks(...)` | Busca vetorial por similaridade de cosseno em `ai_chunks`. |
| `hybrid_search(...)` | Busca híbrida vetorial + tsvector. |

## Realtime

Publicação `supabase_realtime`: `leads`, `messages`, `pipelines`, `pipeline_stages`, `attendants`, `quick_replies`, `lead_tasks`, `lead_internal_notes`, `scheduled_messages`.

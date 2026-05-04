# Modelo de Dados

> **AVISO single-tenant:** todas as tabelas usam policy uniforme `authenticated_all` (qualquer usuário logado vê tudo). Esse modelo serve para uso interno. Antes de abrir multi-cliente é obrigatório migrar para `org_id` + policies escopadas — ver [AUTH.md](AUTH.md).

Schema `public`. Extensões: `pgvector`, `pg_trgm`, `pgcrypto`.

## Núcleo do CRM

### `pipelines`
Pipelines múltiplos (cada um com seu Kanban).
- `id uuid pk`, `name`, `kind text` (`sales`|`internal`), `color`, `position int`, `is_default bool`.
- `whatsapp_instance_id uuid` → instância default desse pipeline.

### `pipeline_stages`
Colunas do Kanban. `id`, `name`, `position int`, `color`, `pipeline_id`.

### `whatsapp_instances`
Múltiplas instâncias Evolution.
- `id`, `name`, `evolution_url`, `evolution_api_key`, `evolution_instance`.
- `webhook_token` (gerado, único), `connection_state`, `last_health_check`, `webhook_ok`, `webhook_last_set_at`, `webhook_last_error`, `last_poll_at`, `is_default bool`.

### `attendants`
- `id`, `name`, `color`.

### `leads`
- `id`, `phone`, `name`, `email`, `company`, `deal_value`, `notes`.
- `tags text[]`, `custom_fields jsonb`.
- `stage_id`, `pipeline_id` (mantido em sync por trigger), `attendant_id`, `position int`.
- `whatsapp_instance_id`.
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
Auditoria — `type`, `payload jsonb`, gravado por trigger `log_lead_changes` (mudanças de `stage_id`/`attendant_id`).

### `lead_internal_notes`
Notas internas. `lead_id`, `author_id`, `author_name`, `text`, `created_at`.

### `lead_tasks`
`lead_id`, `title`, `due_at`, `done_at`. Realtime habilitado.

### `lead_custom_fields`
Definição: `field_key`, `label`, `field_type`, `options jsonb`, `position`.

### `lead_reply_counters`
Rate-limit auto-reply: `(lead_id, hour_bucket)`, `count`, `last_bot_sent_at`.

### `lead_ai_settings`
Por lead: `agent_id`, `auto_reply bool`, `paused_until`.

### `quick_replies`
- `shortcut`, `content`.

### `message_templates`
Templates ricos: `name`, `shortcut`, `content`, `variables jsonb`, `description`.

### `scheduled_messages`
- `lead_id`, `content`, `send_at`, `status` (`pending|sent|failed`), `sent_at`, `last_error`. Realtime habilitado.

### `pending_replies`
Fila de auto-reply (debounce). `lead_id pk`, `agent_id`, `run_at`. Consumida pelo `scheduled-dispatcher`.

## Settings

### `settings` (linha única `id=1`)
Configuração legacy. Instância default migrada para `whatsapp_instances`. Mantida por compatibilidade.

### `webhook_events`
Auditoria de chamadas Evolution: `event_type`, `source` (`webhook|sync|poll`), `payload`, `lead_id`, `received_at`, `processed_at`, `error`.

### `webhook_dedup`
Cache de event hashes (`expires_at`). Limpeza por `cleanup_agent_caches()`.

## Módulo IA

### `ai_agents`
- `name`, `description`, `system_prompt`, `model`, `temperature`, `enabled`, `tools jsonb`.
- `provider` (`openai|anthropic|google`), `api_key`, `base_url`.
- `embedding_model`, `embedding_api_key`, `reranker_provider`, `reranker_api_key`.
- `max_iterations`, `max_tool_calls`, `rag_top_k`, `debounce_seconds`.
- Flags: `use_hyde`, `use_hybrid_search`, `use_memory`, `planning_mode`.

### `ai_documents`
Fonte do RAG. `agent_id`, `title`, `source`, `content`, `metadata`, `doc_summary`.

### `ai_chunks`
- `document_id`, `agent_id`, `chunk_index`, `content`, `token_count`.
- `embedding vector`, `tsv tsvector` (gerado, português).
- Índices: ivfflat para cosseno, GIN para FTS.

### `ai_threads` / `ai_messages`
Histórico do agente. `thread_id`, `role` (`system|user|assistant|tool`), `content`, `tool_calls`, `tool_call_id`.

### `agent_memory`
Memória de longo prazo. `agent_id`, `lead_id?`, `kind`, `content`, `embedding`. Buscada por `match_memories(...)`.

### `agent_mcp_servers`
Servidores MCP por agente.

### `agent_traces`
Trace passo-a-passo. Colunas reais: `run_id`, `step int`, `kind`, `name`, `agent_id`, `thread_id`, `lead_id`, `latency_ms`, `tokens_in`, `tokens_out`, `payload jsonb`, `error`. Inserido via `log_agent_trace(...)`.

### `agent_evals`
Casos de teste: `agent_id`, `prompt`, `expected_contains text[]`, `last_response`, `last_passed`, `last_run_at`.

### `stage_ai_defaults`
Agente default por estágio: `stage_id`, `agent_id`, `auto_reply`.

### `ai_usage`
Telemetria. Colunas reais: `agent_id`, `automation_id`, `lead_id`, `thread_id`, `model`, `operation` (`chat|embed|...`), `status`, `input_tokens`, `output_tokens`, `total_tokens`, `tools_called`, `replied bool`, `latency_ms`, `error`. **Não há coluna `cost`** — custo é derivado pela camada de métricas.

### `embedding_cache`
Por hash de texto + modelo, evita reembedar.

### `rag_cache`
Cache de respostas RAG por `(agent_id, query_hash)`.

## Automações

### `automations`
`name`, `description`, `enabled`, `trigger_type`, `trigger_config jsonb`, `action_type`, `action_config jsonb`, `cooldown_hours`. Ver [AUTOMATIONS.md](AUTOMATIONS.md) para os tipos suportados.

### `automation_runs`
`automation_id`, `lead_id`, `status` (`success|failed|skipped`), `detail`.

## Funções e triggers

| Função | Tipo | Descrição |
|---|---|---|
| `set_updated_at()` | trigger | Atualiza `updated_at`. |
| `set_stage_changed_at()` | trigger | Atualiza `stage_changed_at` quando muda `stage_id`. |
| `sync_lead_pipeline_id()` | trigger | Mantém `leads.pipeline_id` consistente com o estágio. |
| `log_lead_changes()` | trigger | Insere em `lead_events` ao mudar `stage_id`/`attendant_id`. |
| `increment_unread(lead, preview, ts)` | rpc | +1 atomic em `unread_count` + preview. |
| `match_chunks(query_embedding, agent, k)` | rpc | Busca vetorial pura (cosseno). |
| `match_chunks_hybrid(query_embedding, query_text, agent, k)` | rpc | Híbrida vetorial + tsvector com fusão RRF. |
| `match_memories(query_embedding, agent, lead, k)` | rpc | Busca em `agent_memory`. |
| `log_agent_trace(...)` | rpc (security definer) | Insere em `agent_traces`. |
| `cleanup_webhook_events()` | sql | Apaga eventos > 14 dias. |
| `cleanup_agent_caches()` | sql | Limpa `rag_cache`, `webhook_dedup`, `lead_reply_counters`, `agent_traces` antigos. |

## Realtime

Publicação `supabase_realtime`: `leads`, `messages`, `pipelines`, `pipeline_stages`, `attendants`, `quick_replies`, `lead_tasks`, `lead_internal_notes`, `scheduled_messages`.

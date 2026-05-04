# Edge Functions

Localizadas em `supabase/functions/`. Deno + TypeScript. Helpers compartilhados em `_shared/`.

## Tabela resumo

| Função | `verify_jwt` | Família | Propósito |
|---|---|---|---|
| `evolution-webhook` | false | Evolution | Recebe eventos do Evolution (autenticado por `?token=`). |
| `evolution-send` | false | Evolution | Envia mensagem via Evolution. |
| `evolution-test` | false | Evolution | Endpoint de debug. |
| `evolution-sync-lead` | true | Evolution | Reconcilia histórico de um lead. |
| `evolution-backfill-all` | true | Evolution | Reconcilia todos os leads (em lote). |
| `evolution-health` | true | Evolution | Health-check + auto-heal de webhook + poll. |
| `fetch-wa-avatar` | true | Evolution | Busca/atualiza avatar de um número. |
| `transcribe-audio` | true | Jobs | Transcreve mensagens de voz. |
| `ai-chat` | false | IA | Conversa com agente (UI + auto-reply). |
| `ai-assist` | true | IA | Sugestões de resposta para o operador. |
| `ai-auto-reply` | false | IA | **Apenas enfileira** debounce em `pending_replies`. |
| `ai-embed` | false | IA | Gera embeddings ad-hoc. |
| `ai-eval-run` | true | IA | Executa avaliações (`agent_evals`). |
| `ai-ingest-document` | false | IA | Ingestão de texto puro. |
| `ai-ingest-pdf` | false | IA | Ingestão de PDF. |
| `ai-ingest-url` | false | IA | Ingestão de uma URL. |
| `ai-ingest-urls` | true | IA | Ingestão em lote de URLs. |
| `automations-tick` | false | Jobs | Executa automações pendentes (cron). |
| `scheduled-dispatcher` | true | Jobs | Despacha `scheduled_messages` **e** consome `pending_replies` (cron 1 min). |

`verify_jwt` é configurado em `supabase/config.toml` por função.

## Helpers `_shared/`

- **`evolution.ts`** — `loadInstance`, `loadInstanceByToken`, `loadAllInstances`, `evoFetch`, `phoneFromJid`, `extractText`, `ingestMessage` (idempotente), `corsHeaders`, `json`, `sb`.
- **`ai.ts`** — `chunkText`, `embed`, `chatComplete`, tipos `Agent`. Abstrai provider (Lovable AI Gateway, OpenAI, Anthropic, Google).
- **`rag.ts`** — busca via RPC `match_chunks` (vetorial pura) ou `match_chunks_hybrid` (híbrida vetorial + tsvector com fusão RRF). HyDE opcional.
- **`mcp.ts`** — conecta e chama tools de servidores MCP do agente.
- **`metrics.ts`** — registra `ai_usage` e helpers de custo.
- **`utils.ts`** — `webhook_dedup` helpers, etc.

## Família Evolution

### `evolution-webhook`
- Valida `?token=` contra `whatsapp_instances.webhook_token`.
- Persiste em `webhook_events` (audit-first) e deduplica via `webhook_dedup`.
- Trata: `MESSAGES_UPSERT` (ingest), `MESSAGES_UPDATE` (delivery), `CONTACTS_UPSERT` (nome/avatar), `CONNECTION_UPDATE` (state).
- Pós-ingest: para cada mensagem inbound nova, dispara `ai-auto-reply` em fire-and-forget (`EdgeRuntime.waitUntil`).

### `evolution-send`
Body real:
```json
{ "lead_id": "uuid", "text": "string", "client_message_id": "uuid?", "quoted_external_id": "string?" }
```
- Insere `messages` com `status='pending'` (idempotente por `client_message_id`).
- POST `/message/sendText/{instance}` na instância correta do lead.
- Atualiza `external_id` + `status='sent'`. Falha → `status='failed'` + `last_error`.

### `evolution-sync-lead`
Body: `{ lead_id, silent?: boolean }`. Busca histórico via `/chat/findMessages/{instance}` e ingere apenas mensagens novas.

### `evolution-backfill-all`
Itera por todos os leads e chama o sync com `silent=true`.

### `evolution-health`
Watchdog completo: consulta `/webhook/find/{instance}`, comparando com a URL esperada. Se diferente, chama `/webhook/set/{instance}` com `REQUIRED_EVENTS`. Atualiza `connection_state`, `webhook_ok`, `webhook_last_error`. Também faz poll de mensagens recentes para suprir falhas do webhook.

### `fetch-wa-avatar`
Busca foto de perfil do número via `/chat/fetchProfilePictureUrl` e atualiza `leads.avatar_url`.

## Família IA

### `ai-chat`
Conversa interativa (UI `/agents`) **e** motor usado pelo `scheduled-dispatcher` para gerar a resposta automática. Cria/usa `ai_threads` + `ai_messages`. Loop de tool-calling até `max_iterations`. Aplica RAG conforme config do agente.

### `ai-assist`
Sugestões pontuais para o operador no Inbox (rephrase, summarize, traduzir, completar). Não persiste thread.

### `ai-auto-reply` (apenas enfileira)
1. Recebe `{ lead_id }`.
2. Resolve agente: primeiro `lead_ai_settings`, depois `stage_ai_defaults`. Respeita `paused_until` e `agent.enabled`.
3. Faz `upsert` em `pending_replies` com `run_at = now() + agent.debounce_seconds` (mensagens sucessivas estendem o debounce).
4. **Não envia nada.** O envio é feito pelo `scheduled-dispatcher`.

### `ai-embed`
Gera embeddings sob demanda (debug/manual).

### `ai-eval-run`
Executa casos definidos em `agent_evals` e grava resultado.

### `ai-ingest-document` / `ai-ingest-pdf` / `ai-ingest-url` / `ai-ingest-urls`
Pipeline de ingestão:
1. Cria `ai_documents`.
2. `chunkText` (default 800 chars / overlap 100).
3. Gera embeddings em batch (`embed`).
4. Insere em `ai_chunks` com vetor + `tsvector` (gerado em português).

PDF: extração de texto antes do chunking. URL: scrape + limpeza HTML antes do chunking.

## Jobs

### `automations-tick`
Cron. Lê `automations` ativas, busca candidatos de acordo com `trigger_type`, executa `action_type` e grava em `automation_runs` respeitando `cooldown_hours`. Triggers e ações implementadas estão listadas em [AUTOMATIONS.md](AUTOMATIONS.md).

### `scheduled-dispatcher` (cron, ~1 min)
Faz **duas coisas** em cada execução:
1. **`scheduled_messages`** com `status='pending'` e `send_at <= now()` → chama `evolution-send` → atualiza `status` para `sent`/`failed`.
2. **`pending_replies`** com `run_at <= now()` → reclama atomicamente (DELETE … RETURNING) → busca últimas 20 mensagens do lead → cria/usa `ai_threads` → chama `ai-chat` para gerar a resposta → envia via `evolution-send`.

> **Latência mínima da auto-resposta** = `agent.debounce_seconds` + intervalo do cron (até ~1 min). Para reduzir, pode-se invocar o `scheduled-dispatcher` direto após o webhook (não implementado hoje).

### `transcribe-audio`
Recebe URL de mídia de áudio, transcreve via STT e atualiza `messages.content` (mantendo a URL original).

## Configuração

`supabase/config.toml` define overrides de `verify_jwt` por função. Confira a tabela acima — várias funções de IA e jobs rodam **sem JWT** porque são chamadas server-to-server com a service role key.

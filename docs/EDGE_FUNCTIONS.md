# Edge Functions

Localizadas em `supabase/functions/`. Deno + TypeScript. Helpers compartilhados em `_shared/`.

## Tabela resumo

| Função | `verify_jwt` | Família | Propósito |
|---|---|---|---|
| `evolution-webhook` | false | Evolution | Recebe eventos do Evolution (autenticado por `?token=`). |
| `evolution-send` | false | Evolution | Envia mensagem via Evolution. |
| `evolution-sync-lead` | true | Evolution | Reconcilia histórico de um lead. |
| `evolution-backfill-all` | true | Evolution | Reconcilia todos os leads (em lote). |
| `evolution-health` | true | Evolution | Health-check da instância. |
| `evolution-test` | false | Evolution | Endpoint de debug. |
| `fetch-wa-avatar` | true | Evolution | Busca/atualiza avatar de um número. |
| `transcribe-audio` | true | Inbox | Transcreve mensagens de voz. |
| `ai-chat` | true | IA | Conversa interativa com agente (UI). |
| `ai-assist` | true | IA | Sugestões de resposta para o operador. |
| `ai-auto-reply` | true | IA | Processa fila `pending_replies` e responde leads. |
| `ai-embed` | true | IA | Gera embeddings ad-hoc. |
| `ai-eval-run` | true | IA | Executa avaliações (`agent_evals`). |
| `ai-ingest-document` | true | IA | Ingestão de texto puro. |
| `ai-ingest-pdf` | true | IA | Ingestão de PDF (extração + chunking). |
| `ai-ingest-url` | true | IA | Ingestão de uma URL (scrape). |
| `ai-ingest-urls` | true | IA | Ingestão em lote de URLs. |
| `automations-tick` | true | Jobs | Executa automações pendentes (cron). |
| `scheduled-dispatcher` | true | Jobs | Dispara mensagens agendadas (cron). |

`verify_jwt` é configurado em `supabase/config.toml` por função quando precisa diferir do default.

## Helpers `_shared/`

- **`evolution.ts`** — `loadSettings`, `evoFetch`, `phoneFromJid`, `extractText`, `ingestMessage` (idempotente), `corsHeaders`, `json`, `sb`.
- **`ai.ts`** — `chunkText`, `embed`, `chatComplete`, tipos `Agent`. Abstrai provider (Lovable AI Gateway, OpenAI, Anthropic, Google).
- **`rag.ts`** — busca híbrida (vetorial + FTS), HyDE opcional, reranker.
- **`mcp.ts`** — conecta e chama tools de servidores MCP do agente.
- **`metrics.ts`** — registra `ai_usage` e helpers de custo.
- **`utils.ts`**, **`types.ts`** — utilitários gerais.

## Família Evolution

### `evolution-webhook`
- Valida `?token=` contra `whatsapp_instances.webhook_token` (ou `settings.webhook_token` legado).
- Persiste em `webhook_events` (audit-first) e deduplica via `webhook_dedup`.
- Trata: `MESSAGES_UPSERT` (ingest), `MESSAGES_UPDATE` (delivery), `CONTACTS_UPSERT` (nome/avatar), `CONNECTION_UPDATE` (state).
- Pós-ingest: cria/atualiza `pending_replies` se o lead tem auto-reply.

### `evolution-send`
Body:
```json
{ "lead_id": "uuid", "content": "texto", "client_message_id": "uuid", "reply_to_external_id": "string?" }
```
- Insere `messages` com `status='pending'` (idempotente por `client_message_id`).
- POST `/message/sendText/{instance}` na instância correta do lead.
- Atualiza `external_id` + `status='sent'`. Falha → `status='failed'` + `last_error`.

### `evolution-sync-lead`
Body: `{ lead_id, silent?: boolean }`. Busca histórico via `/chat/findMessages/{instance}` e ingere apenas mensagens novas.

### `evolution-backfill-all`
Itera por todos os leads e chama o sync com `silent=true`. Útil pós-restauração.

### `evolution-health`
Consulta status e atualiza `connection_state` + `last_health_check`.

### `fetch-wa-avatar`
Busca foto de perfil do número e atualiza `leads.avatar_url`.

## Família IA

### `ai-chat`
Conversa interativa (UI `/agents`). Cria/usa `ai_threads` + `ai_messages`. Loop de tool-calling até `max_iterations`. Aplica RAG conforme config do agente.

### `ai-assist`
Sugestões pontuais para o operador no Inbox (rephrase, summarize, traduzir, completar). Não persiste thread.

### `ai-auto-reply`
Job principal de respostas automáticas:
1. Lê `pending_replies` com `run_at <= now()`.
2. Agrupa mensagens recentes do lead (debounce).
3. Executa agente (`lead_ai_settings.agent_id`) com RAG + MCP.
4. Envia resposta via `evolution-send`.
5. Respeita `paused_until`, `lead_reply_counters` (rate-limit) e `agent.enabled`.
6. Grava `ai_usage` e `agent_traces`.

### `ai-embed`
Gera embeddings sob demanda (debug/manual).

### `ai-eval-run`
Executa casos definidos em `agent_evals` e grava resultado.

### `ai-ingest-document` / `ai-ingest-pdf` / `ai-ingest-url` / `ai-ingest-urls`
Pipeline de ingestão:
1. Cria `ai_documents`.
2. Chama `chunkText` (default 800 chars / overlap 100).
3. Gera embeddings em batch (`embed`).
4. Insere em `ai_chunks` com vetor + tsvector automático.

PDF: extração de texto antes do chunking. URL: scrape + limpeza HTML antes do chunking.

## Jobs auxiliares

### `automations-tick`
Cron. Lê `automations` ativas, avalia gatilhos contra eventos recentes (mensagens, mudanças de estágio, tags) e dispara ações. Grava `automation_runs`.

### `scheduled-dispatcher`
Cron. Lê `scheduled_messages` com `status='pending'` e `send_at <= now()`. Chama `evolution-send`. Atualiza `status` e `sent_at`/`last_error`.

### `transcribe-audio`
Recebe URL de mídia de áudio, transcreve via modelo de speech-to-text e atualiza `messages.content` (mantendo a URL original).

## Configuração

`supabase/config.toml` define overrides por função (ex.: `verify_jwt = false` para `evolution-webhook`, `evolution-send`, `evolution-test`). Demais funções usam JWT padrão.

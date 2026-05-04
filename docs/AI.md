# Módulo de IA

Agentes conversacionais com RAG (Retrieval-Augmented Generation), auto-reply por lead, integração com servidores MCP, ferramentas (tools) e telemetria de custos.

## Conceitos

| Tabela | Papel |
|---|---|
| `ai_agents` | Configuração do agente (prompt, modelo, RAG, tools). |
| `ai_documents` | Fontes da base de conhecimento. |
| `ai_chunks` | Pedaços vetorizados (pgvector + tsvector). |
| `ai_threads` / `ai_messages` | Histórico de conversa. |
| `agent_memory` | Memória de longo prazo (summary). |
| `agent_mcp_servers` | Servidores MCP conectados. |
| `agent_traces` | Trace passo-a-passo de uma execução. |
| `agent_evals` | Casos de teste. |
| `stage_ai_defaults` | Agente default por estágio do pipeline. |
| `lead_ai_settings` | Por lead: agente + auto-reply + pausa. |
| `pending_replies` | Fila de auto-reply (debounce). |
| `lead_reply_counters` | Rate-limit por hora. |
| `ai_usage` | Tokens e custo por execução. |
| `embedding_cache` / `rag_cache` | Caches para reduzir custo. |

## Configuração de agente

Campos principais de `ai_agents`:

- **Identidade**: `name`, `description`, `system_prompt`.
- **Modelo**: `provider` (`openai|anthropic|google`), `model`, `temperature`, `api_key`, `base_url`.
- **Embeddings**: `embedding_model`, `embedding_api_key` (se vazio, usa o default do provider).
- **Reranker** (opcional): `reranker_provider`, `reranker_api_key`.
- **RAG**: `rag_top_k` (default 5), `use_hyde`, `use_hybrid_search` (default true).
- **Loop**: `max_iterations` (6), `max_tool_calls` (12).
- **Memória**: `use_memory` (escreve/lê resumo em `agent_memory`).
- **Planejamento**: `planning_mode` (decompõe a tarefa antes de executar).
- **Auto-reply**: `debounce_seconds` (8) — janela de espera antes de responder.
- **Tools**: `tools jsonb` — lista de tools nativas habilitadas.

> Por padrão, a aplicação usa **Lovable AI Gateway** (modelos Google/OpenAI sem API key). Para usar provedores próprios, preencha `api_key` (e `base_url` se necessário).

## RAG

### Ingestão

Quatro funções, todas em `supabase/functions/ai-ingest-*`:
- `ai-ingest-document` — texto puro.
- `ai-ingest-pdf` — extrai texto de PDF.
- `ai-ingest-url` — scrape de uma URL.
- `ai-ingest-urls` — lote de URLs.

Pipeline (em `_shared/ai.ts`):
1. `chunkText(content, 800, 100)` — chunks de ~800 chars com overlap de 100.
2. `embed(agent, batch)` em batches de 16.
3. INSERT em `ai_chunks` com `embedding vector(768)`. O `tsvector` é gerado pelo Postgres em português.

### Busca

`_shared/rag.ts` chama duas RPCs no Postgres:
- **`match_chunks(query_embedding, agent_id, k)`** — vetorial pura (cosseno).
- **`match_chunks_hybrid(query_embedding, query_text, agent_id, k)`** — vetorial + FTS português com fusão RRF (`SUM(1 / (60 + rnk))`). Usada quando `use_hybrid_search=true`.

Adicionalmente:
- **HyDE** (`use_hyde`): pede ao LLM uma resposta hipotética e usa o embedding dela para a busca.
- **Reranker** opcional (Cohere/Voyage/etc.) controlado por `reranker_provider`.

Cache: `embedding_cache` (por hash do texto) e `rag_cache` (por hash da query + agent).

## Threads e mensagens

`ai-chat` mantém uma `ai_thread` por sessão (UI ou auto-reply). `ai_messages` armazena cada turno (`system|user|assistant|tool`) com `tool_calls` e `tool_call_id` para o protocolo de function calling.

Loop de execução:
1. Monta contexto (system + memória + RAG + histórico).
2. Chama LLM.
3. Se houver tool calls → executa (nativas, MCP) → adiciona como mensagens `tool`.
4. Repete até resposta final ou `max_iterations`.

## Auto-reply por lead

Ative em `lead_ai_settings`:
```sql
INSERT INTO lead_ai_settings (lead_id, agent_id, auto_reply)
VALUES ('...', '...', true);
```

Fluxo real (duas funções colaboram):
1. Mensagem do cliente chega → `evolution-webhook` chama `ai-auto-reply` em fire-and-forget.
2. `ai-auto-reply` resolve agente (lead → estágio), respeita `paused_until` / `agent.enabled`, e faz upsert em `pending_replies` com `run_at = now() + agent.debounce_seconds`. **Não envia nada.**
3. Mensagens subsequentes na janela apenas estendem o `run_at` (debounce).
4. `scheduled-dispatcher` (cron ~1 min) reclama atomicamente as `pending_replies` vencidas, monta histórico do lead, chama `ai-chat` para gerar a resposta e dispara `evolution-send`.
5. Grava `ai_usage` e `agent_traces` (via `log_agent_trace`).

> Latência mínima ≈ `debounce_seconds` + intervalo do cron.

Pausar IA temporariamente: defina `paused_until` em `lead_ai_settings`.

## MCP (Model Context Protocol)

Cada agente pode ter servidores MCP em `agent_mcp_servers`. `_shared/mcp.ts` lista as tools expostas, registra com o LLM e roteia chamadas. Útil para integrar APIs externas sem codar tool por tool.

## Evals

Cadastre casos em `agent_evals` (`prompt`, `expected_contains text[]`) e rode `ai-eval-run`. Resultado fica em `last_response`, `last_passed`, `last_run_at`.

## Telemetria

Toda execução grava em `ai_usage`:
- Identificação: `agent_id`, `lead_id`, `thread_id`, `automation_id`.
- Modelo: `model`, `operation` (`chat|embed|...`), `status`.
- Tokens: `input_tokens`, `output_tokens`, `total_tokens`.
- Métricas: `tools_called`, `replied`, `latency_ms`, `error`.

Não há coluna `cost` armazenada — o custo é calculado pela camada de métricas a partir do modelo + tokens.

Use `/metrics/ops` para visualizar custo agregado.

## Defaults por estágio

`stage_ai_defaults` permite que um pipeline atribua automaticamente um agente quando o lead entra num estágio (ex.: estágio "Qualificação" → agente "SDR").

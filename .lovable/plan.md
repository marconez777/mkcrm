## Visão geral

Hoje os agentes têm o básico: chat multi-provider (OpenAI/Anthropic/Google), RAG ingênuo (chunks de 800 chars + top-5), 4 ferramentas (mover etapa, anotar, atualizar campo, atribuir atendente) e auto-reply imediato a cada mensagem. Vamos elevar a 3 níveis: **(1) RAG state-of-the-art**, **(2) Agente verdadeiramente agêntico** (mais ferramentas, planejamento, memória), **(3) MCP** para conectar fontes externas dinamicamente.

---

## Pesquisa rápida das tendências aplicáveis (2025/2026)

- **RAG**: chunking semântico + late-chunking, **hybrid search** (vetor + BM25/full-text + reranker), **HyDE** (Hypothetical Doc Embeddings) para reformular a query, **query rewriting** com histórico, **reranking** com modelos cross-encoder (Cohere Rerank / BGE-Reranker / Gemini Reranker), embeddings de 1024–3072 dims (text-embedding-3-large, voyage-3, gemini-embedding-001), **contextual retrieval** (Anthropic) — prefixar cada chunk com um resumo do documento.
- **Agentes**: padrão **ReAct + reflection**, **planning loop** (plan→act→critique), **memória episódica** (resumos por lead) e **memória semântica** (preferências). **Streaming de tool calls**, **paralelismo** de tools, **guardrails** (validação JSON via tool_choice forçado).
- **MCP (Model Context Protocol)**: servidores expõem ferramentas/recursos via HTTP streamable; o agente pode chamar serviços externos (Calendar, CRM, planilhas, busca web) sem hardcode. Vamos adicionar um **cliente MCP** no edge function.
- **Avaliação**: tracing por turno (já temos `ai_usage`) + **eval harness** com casos golden (asserts simples).
- **Latência**: cache de embeddings (hash do texto), cache de respostas RAG por agente+pergunta, debounce de auto-reply (agrupa rajada de mensagens), streaming SSE no playground.

---

## Mudanças propostas

### 1. RAG avançado (`ai-chat` + `ai-embed` + nova função `ai-retrieve`)

- **Chunking semântico**: dividir por parágrafos/sentenças, alvo 400–600 tokens, com overlap de 1 sentença. Anexar *contextual prefix* (título do doc + resumo de 1 frase gerado na ingestão).
- **Hybrid search**: além de `match_chunks` (vetor), criar coluna `tsv tsvector` em `ai_chunks` com índice GIN e função `match_chunks_hybrid` que combina score vetorial + score `ts_rank_cd` (RRF — Reciprocal Rank Fusion).
- **Query rewriting + HyDE**: antes de embutir a pergunta, chamar o LLM (modelo barato, gemini-flash-lite) para: (a) reescrever considerando histórico, (b) gerar uma "resposta hipotética" — embedar essa para retrieval.
- **Reranker**: após hybrid (top-20), re-ranquear com Cohere Rerank ou Gemini reranker para top-5 finais. API key opcional por agente (`reranker_provider`, `reranker_api_key`).
- **Citações**: retornar `[1]`, `[2]` no texto e payload `sources` com doc_id, snippet, score — exibir no playground.

### 2. Agente agêntico

- **Loop estendido**: subir `max_iter` para 8, adicionar etapa de **plan** opcional (system prompt extra "primeiro pense em passos") e **self-critique** no final ("verifique se respondeu").
- **Tool paralelism**: executar `Promise.all` quando o modelo emite múltiplas tool_calls.
- **Novas ferramentas built-in** (registrar em `TOOL_DEFINITIONS`):
  - `search_knowledge_base(query)` — chama RAG explicitamente
  - `create_task(title, due_at)` — usa `lead_tasks`
  - `schedule_message(text, send_at)` — usa `scheduled_messages`
  - `get_lead_history(limit)` — últimas N mensagens
  - `web_search(query)` — via Lovable AI (Gemini com grounding) ou Tavily (secret opcional)
  - `transfer_to_human()` — pausa auto-reply e marca lead
  - `update_custom_field(key, value)` — usa `lead_custom_fields`
- **Memória**:
  - Tabela nova `agent_memory` (`lead_id`, `agent_id`, `kind` enum `summary|fact|preference`, `content`, `embedding`, `created_at`).
  - Após cada turno, função `summarize-thread` (background) condensa as últimas 10 trocas em 1 resumo (substitui as antigas no contexto).
  - Recall: top-3 memórias por similaridade entram no system prompt.

### 3. MCP (Model Context Protocol)

- Tabela `agent_mcp_servers` (`agent_id`, `name`, `url`, `headers jsonb`, `enabled`).
- Em `ai-chat`: ao montar tools, fazer handshake `tools/list` em cada server MCP do agente e mesclar as ferramentas; quando o modelo chamar uma tool MCP, fazer `tools/call` HTTP streamable (`Accept: application/json, text/event-stream`).
- UI em `Agents.tsx`: aba "MCP Servers" com CRUD (URL + headers JSON).

### 4. Auto-reply mais inteligente (`ai-auto-reply`)

- **Debounce**: ao receber mensagem, agendar reply para `now + 8s` numa nova tabela `pending_replies` (lead_id unique). Se chegar outra mensagem antes, atualizar `run_at` (estende). Cron `scheduled-dispatcher` (já existe) processa.
- **Typing indicator**: chamar Evolution `presence` "composing" antes do envio.
- **Anti-loop**: nunca responder se a última mensagem `from_me` foi enviada há < 3s pelo próprio agente; respeitar `paused_until`.
- **Handoff**: se confiança baixa (modelo retorna `transfer_to_human`), notificar atendente.

### 5. Playground & Observabilidade (`Agents.tsx`)

- **Streaming SSE** no playground (já temos padrão Lovable AI gateway).
- Painel de **traços** por thread: tokens, latência, ferramentas chamadas, fontes RAG citadas — lendo de `ai_usage`.
- **Eval runner**: lista de casos (`agent_evals`: prompt, expected_contains[]) com botão "rodar tudo" e taxa de sucesso.

### 6. Defaults e UX

- Trocar default do agente para **`google/gemini-3-flash-preview`** (já é) e adicionar opção **`google/gemini-3.1-pro-preview`** para tarefas complexas.
- Permitir **múltiplos agentes em pipeline** (router agent → especialistas) via tool `delegate_to_agent(agent_name, task)`.

---

## Detalhes técnicos

### Migrations
```sql
-- Hybrid search
ALTER TABLE ai_chunks ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(content,''))) STORED;
CREATE INDEX ai_chunks_tsv_idx ON ai_chunks USING GIN(tsv);
ALTER TABLE ai_chunks ADD COLUMN doc_summary text;

-- Memória
CREATE TABLE agent_memory (
  id uuid PK, lead_id uuid, agent_id uuid,
  kind text CHECK (kind IN ('summary','fact','preference')),
  content text, embedding vector(768), created_at timestamptz default now()
);
CREATE INDEX ON agent_memory USING ivfflat (embedding vector_cosine_ops);

-- MCP
CREATE TABLE agent_mcp_servers (
  id uuid PK, agent_id uuid REFERENCES ai_agents ON DELETE CASCADE,
  name text, url text, headers jsonb default '{}', enabled bool default true
);

-- Debounce
CREATE TABLE pending_replies (
  lead_id uuid PRIMARY KEY, agent_id uuid, run_at timestamptz, created_at timestamptz default now()
);

-- Evals
CREATE TABLE agent_evals (
  id uuid PK, agent_id uuid, prompt text, expected_contains text[],
  last_run_at timestamptz, last_passed boolean
);

-- Reranker config
ALTER TABLE ai_agents 
  ADD COLUMN reranker_provider text,
  ADD COLUMN reranker_api_key text,
  ADD COLUMN max_iterations int default 5,
  ADD COLUMN use_hyde boolean default false,
  ADD COLUMN use_hybrid_search boolean default true;
```

### Edge functions novas/alteradas
- `_shared/ai.ts`: adicionar `streamChatCompletion`, helper `rerank()`.
- `_shared/rag.ts` (novo): `retrieveContext({agent, query, history})` → query rewrite + HyDE + hybrid + rerank + memórias.
- `_shared/mcp.ts` (novo): `listMcpTools(server)`, `callMcpTool(server, name, args)`.
- `ai-chat/index.ts`: usar `retrieveContext`, mesclar MCP tools, paralelismo de tools, streaming opcional (`stream: true` no body).
- `ai-auto-reply/index.ts`: gravar em `pending_replies`, retornar imediatamente.
- `scheduled-dispatcher`: processar `pending_replies` quando `run_at <= now()`.
- `ai-summarize-thread` (novo): cron diário ou após cada turno via background task.
- `ai-eval-run` (novo): roda casos do `agent_evals`.

### Frontend (`src/pages/Agents.tsx`)
- Nova aba **"Avançado"**: toggles HyDE / Hybrid / Reranker provider + key, max_iterations.
- Nova aba **"MCP"**: CRUD de servers.
- Nova aba **"Memória"**: listar/limpar memórias por lead.
- Nova aba **"Evals"**: CRUD + rodar.
- Playground: streaming, exibir fontes citadas, mostrar tool calls em tempo real.

---

## Ordem de implementação (1 entrega)

1. Migrations (todas as tabelas/colunas acima).
2. `_shared/rag.ts` com hybrid + rerank + HyDE + memória recall.
3. Atualizar `ai-chat` (RAG novo, novas tools built-in, paralelismo, max_iter dinâmico, citações).
4. `_shared/mcp.ts` + integração em `ai-chat`.
5. Debounce de auto-reply (`pending_replies` + scheduler).
6. `ai-summarize-thread` background.
7. UI: abas Avançado / MCP / Memória / Evals + playground com streaming e fontes.
8. Sanity test via `curl_edge_functions`.

Após sua aprovação, aplico tudo em uma rodada.
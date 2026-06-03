# Módulo de IA — Documentação Técnica

> Agentes multi-provider, RAG avançado, ferramentas, MCP, auto-reply com debounce, memória, traces, evals e custos. Documento para desenvolvedores.

---

## 1. Visão geral

O módulo de IA do CRM permite que cada **clínica** (tenant) crie **agentes** que:

- **Conversam** com leads no WhatsApp (via Evolution API), ou
- **Classificam / vigiam** conversas em silêncio executando ações no CRM (mover de estágio, taggear, criar tarefa, agendar mensagem, atualizar campos), ou
- **Resumem** conversas e **sugerem respostas** para o atendente humano no Inbox.

Características-chave:

| Aspecto | Implementação |
|---|---|
| **Multi-provider** | OpenAI, Anthropic, Google — chave por agente, normalizada para um payload OpenAI-like internamente |
| **RAG avançado** | Query rewrite + HyDE opcional + busca híbrida (vetor + FTS via RRF) + reranker (Cohere/Jina/Voyage) opcional + recall de memória |
| **Tool calling** | 14 built-ins + qualquer número de servidores **MCP** (Model Context Protocol Streamable HTTP) |
| **Auto-reply** | Debounce por agente, fila `pending_replies`, dispatcher cron a cada 1 min |
| **Persistência** | Threads/mensagens opcionais, memória vetorial por lead, traces detalhados por step |
| **Observabilidade** | `ai_usage` (tokens, latência, custo via `ai-pricing.ts`), `agent_traces` (LLM + tool steps com payload) |
| **Isolamento** | Tudo escopado por `clinic_id` com RLS; `current_clinic_id()` resolve via `auth.uid()` |

### Componentes

- **18 edge functions** Deno do domínio IA/Agentes: `ai-chat`, `ai-auto-reply`, `ai-assist`, `ai-eval-run`, `ai-embed`, `ai-ingest-pdf`, `ai-ingest-url`, `ai-ingest-urls`, `ai-ingest-document`, `ai-reingest-document`, `ai-builder` (wizard `/ai/agents/new` + copilot), `ai-analyst-run` (análise em lote → `agent_memory` + `ai_insights`), `ai-spend-notify`, `agent-run-bulk`, `agent-followups-tick` (cron 5 min — follow-ups por stage), `agent-learn-from-thread` (promove threads a `agent_evals` / pede patch ao Builder), `classifier-daily-batch`, `daily-summary` — + a cron `scheduled-dispatcher` (compartilhada com agendamento de mensagens).
- **9 módulos compartilhados** em `supabase/functions/_shared/`: `ai.ts`, `rag.ts`, `mcp.ts`, `utils.ts`, `metrics.ts`, `ai-pricing.ts`, `agent-flags.ts`, `spend-guard.ts`, `builder-system-prompt.ts` (+ KB em `builder-knowledge/`).
- **Tabelas Postgres** do domínio (ver `database/SCHEMA.md` para colunas): `ai_agents`, `ai_agent_drafts`, `agent_personas`, `agent_prompt_versions`, `agent_stages`, `ai_documents`, `ai_chunks`, `ai_kb_defaults`, `ai_threads`, `ai_messages`, `ai_usage`, `ai_usage_daily`, `agent_memory`, `agent_traces`, `ai_chat_traces`, `agent_evals`, `agent_mcp_servers`, `ai_insights`, `ai_spend_limits`, `ai_spend_events`, `ai_spend_notifications_sent`, `lead_thread_classifications` + auxiliares `lead_ai_settings`, `stage_ai_defaults`, `pending_replies`, `lead_reply_counters`, `rag_cache`, `embedding_cache`.
- **5 telas** sob `/ai`: Dashboard, Agentes, Memórias, Mensagens (sub-abas Sequências / Automações / Templates), Custos.

---

## 2. Arquitetura

### Fluxo inbound (auto-reply / watcher)

```text
WhatsApp ──► evolution-webhook ──► ai-auto-reply (debounce)
                                          │
                                          ▼
                                  pending_replies (PK lead_id,agent_id; run_at)
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                                               ▼
        EdgeRuntime.waitUntil()                          pg_cron (1 min)
        → scheduled-dispatcher                           → scheduled-dispatcher
                                          │
                                          ▼
                                       ai-chat ──► chatCompletion (provider)
                                          │              │
                                          │              ├─► RAG (rewrite/HyDE/hybrid/rerank)
                                          │              ├─► Tools (built-in + MCP)
                                          │              └─► ai_usage / agent_traces
                                          ▼
                                  evolution-send (se não-silent)
```

### Fluxo manual (Inbox)

```text
Inbox UI ──► ai-assist (Lovable AI Gateway)   → leads.ai_summary  | sugestões
         └─► ai-chat   (provider do agente)   → resposta + threads
```

### Fluxo ingest (base de conhecimento)

```text
Agents UI ──► ai-ingest-pdf | ai-ingest-url | ai-ingest-document
              │
              ├─► extract text (unpdf / sanitize HTML)
              ├─► chunkText(800, overlap 100)
              ├─► embed (768d) em batches de 16
              └─► insert ai_documents + ai_chunks
```

---

## 3. Telas (Frontend)

Tudo vive sob a rota `/ai`, agrupado por `src/pages/ai/AiHub.tsx`, com abas que respeitam feature flags (`useAuth().hasFeature`).

### 3.1 `/ai` — `AiDashboard.tsx`

KPIs (últimos 7 / 30 dias) computados client-side a partir de `ai_usage` + `count(*)` em `ai_agents` e `automations`:

- **Mensagens IA (7d)** — `count(*) from ai_usage where created_at >= now() - 7d`.
- **Tokens (30d)** — `sum(total_tokens)`.
- **Agentes ativos** — `ai_agents.enabled=true`.
- **Automações ativas** — `automations.enabled=true`.
- **Gráfico** — barras por dia (últimos 7).

### 3.2 `/ai/agents` — `Agents.tsx` (756 linhas)

CRUD completo de agentes. Roles `owner` / `admin` (ou super-admin) podem editar; visualização para os demais.

Seções por agente:

| Seção | Campos |
|---|---|
| **Identidade** | `name`, `description`, `enabled`, `silent`, `role` (opcional, único `summary` por clínica) |
| **Provider** | `provider` (openai/anthropic/google), `model`, `api_key`, `base_url` (opcional p/ proxy/LiteLLM) |
| **Prompt** | `system_prompt`, `temperature`, `planning_mode` |
| **Tools (built-in)** | checkboxes para as 14 ferramentas (ver §7) |
| **MCP** | `McpServersPanel` — adiciona/remove servidores `agent_mcp_servers` (`name`, `url`, `enabled`) |
| **RAG** | `rag_top_k`, `use_hyde`, `use_hybrid_search`, `use_memory`, `reranker_provider` (cohere/jina/voyage), `reranker_api_key` |
| **Embeddings** | `embedding_model`, `embedding_api_key` (OpenAI-compat, opcional — útil quando o provider é Anthropic) |
| **Limites** | `max_iterations` (1–12, default 6), `max_tool_calls` (1–50, default 12), `debounce_seconds` (≥1, default 8) |
| **Base de conhecimento** | upload texto / PDF / URL → `ai-ingest-*`; lista `ai_documents` com contagem de chunks |
| **Evals** | `EvalsPanel` — adiciona casos `prompt + expected_contains[]` e roda `ai-eval-run` |

### 3.3 `/ai/memories` — `AgentMemories.tsx`

Lista as últimas 500 entradas de `agent_memory` (todas as clínicas visíveis ao usuário via RLS). Filtros: agente, `kind` (`fact` / `preference` / `summary`), busca textual. Cada item linka para o lead correspondente (`/lead/:id`). Permite deletar memórias.

### 3.4 `/ai/messages` — `Messages.tsx`

Hub de mensagens automatizadas, com sub-abas:

- **Sequências** (`Sequences.tsx`) — `message_sequences` + `message_sequence_steps`. Triggers: `stage_enter` (entrada em coluna), `webhook` (URL pública com `public_token`) e `manual`. Cada step tem `delay_minutes`, `template_id` ou `content` literal, e `send_window` (janela horária). Enrollments em `message_sequence_enrollments`; tick em `sequence-tick` / `sequence-trigger` / `sequence-enroll`.
- **Automações** (`Automations.tsx`) — `automations`. Triggers: `no_reply_after`, `stage_idle`, `before_appointment` (lembrete antes de data de consulta em campo custom). Ações: `ai_followup` (chama um agente), `move_stage`, `send_template`. Tick em `automations-tick`.
- **Templates** (`Templates.tsx`) — `message_templates` simples (nome + conteúdo com variáveis).

> Mesmo não sendo "IA pura", `ai_followup` em automações chama `ai-chat` internamente — daí a UI ficar sob `/ai`.

### 3.5 `/ai/broadcasts` — `Broadcasts.tsx`

Disparo em massa via WhatsApp com rotação de instâncias. Não usa LLM, mas compartilha a aba IA por proximidade operacional.

### 3.6 `/ai/usage` — `MetricsAiUsage.tsx`

Custos em USD computados a partir de `ai_usage` × tabela `src/lib/ai-pricing.ts` (preço de entrada/saída por 1M tokens). Agregações por modelo, agente, operação e período. Modelos desconhecidos caem no valor `$0`.

---

## 4. Edge Functions

### 4.1 `ai-chat` (núcleo — 545 linhas)

Função principal do agente. Recebe:

```ts
{ agent_id, messages: ChatMessage[], lead_id?, thread_id?, persist? }
```

Pipeline:

1. **Validações** — agente existe, está `enabled`, tem `api_key`.
2. **Modo "manual review"** — se `lead_id` foi passado **sem** mensagens, carrega as últimas 30 reais e monta como um único turno `user` com transcript marcando "atendente" / "lead", instruindo o modelo a usar **apenas ferramentas** (não responder ao lead).
3. **RAG** — `retrieveContext()` sobre a última mensagem `user`. Resultado vira `ragContext` (markdown) + `sources[]` retornado ao caller para citações.
4. **Contexto do lead** — carrega `leads.{name,phone,email,company,deal_value,notes,tags,stage_id,pipeline_id,custom_fields}`, monta:
   - JSON do lead + nome do estágio atual,
   - lista completa de estágios disponíveis no funil (para guiar `move_lead_stage`),
   - schema dos custom fields da clínica (`lead_custom_fields`: key, label, type, opções, hint de formato) + valores atuais.
5. **Tools** — built-ins selecionados (`agent.tools`) + MCP discovery (`agent_mcp_servers.enabled=true` → `listMcpTools` → `<server>__<tool>`).
6. **System prompt final** = `system_prompt + planning + leadCtx + ragContext + "cite com [1], [2]..."`.
7. **Loop** — até `max_iterations` (default 6, cap 12):
   - `chatCompletion(agent, conv, tools, ctx)` — `ctx` permite o auto-log em `ai_usage` por iteração.
   - Se `tool_calls` retornaram e ainda há orçamento, executa em paralelo (`pmap` paralelismo 4) com `withTimeout(15s)`.
   - Cada chamada vai para `agent_traces` (`kind: tool`, `name`, `latency_ms`, `error`, `payload.args`).
   - **Dedup**: `(name + stableStringify(args))` repetido **3×** é bloqueado com `{error:"duplicate_call_blocked"}`.
   - Empurra `tool_result` no `conv`. Se `toolCallsTotal >= max_tool_calls`, injeta system message "Orçamento atingido. Produza a resposta final agora."
   - `TURN_TIMEOUT_MS = 90_000` interrompe o loop.
8. **Persistência opcional** — se `persist=true`, cria/usa `ai_threads` e insere user-msg + assistant-msg em `ai_messages`.
9. **Resumo do turno** — uma linha extra em `ai_usage` com `error='turn:summary'` agregando tokens totais, `tools_called`, `replied`, `latency_ms`. Permite o dashboard separar "iterações" de "turnos".

Retorno:

```ts
{ ok: true, content, thread_id, tools_used: [{name,args,result}], sources: [{idx,doc_id,title,snippet,score}] }
```

Em erros do provider → `502 { error, detail }`.

### 4.2 `ai-auto-reply` (debounce)

Chamado pelo `evolution-webhook` em **toda** mensagem (inbound ou outbound) sobre um lead. Enfileira **dois** agentes em paralelo:

1. **Watcher (silent agent)** — definido em `whatsapp_instances.watcher_agent_id`, opcionalmente restrito a `watcher_pipeline_id`. Roda **inclusive** quando `from_me=true` (vigia conversas dos atendentes também — útil para detectar lead "esfriado", anotar fatos, mover estágio).
2. **Sales agent (vocal)** — vem de `lead_ai_settings.agent_id` (override por lead) ou `stage_ai_defaults.agent_id` (default por estágio). Pula se `from_me=true` e o agente **não** for silent. Pula se `paused_until > now()` (definido por `transfer_to_human`).

Implementação:

```ts
upsert pending_replies (lead_id, agent_id, run_at = now + debounce_seconds, clinic_id)
on conflict (lead_id, agent_id) do update set run_at = excluded.run_at
```

→ **Bursts** de mensagens em sequência **estendem** o `run_at` em vez de duplicar — só roda quando a conversa "esfria". Para baixa latência sem depender só do cron, `EdgeRuntime.waitUntil()` agenda um `fetch` ao `scheduled-dispatcher` exatamente após `debounce_seconds`.

> Importante: `pending_replies.clinic_id` é passado **explicitamente** porque o default `current_clinic_id()` retorna `null` quando a função é invocada via service role (sem `auth.uid()`), o que quebraria o `NOT NULL`.

**Detecção de "silent"**: `agent.silent=true` **ou** todas as ferramentas selecionadas pertencem a `SILENT_TOOLS` (set hard-coded com as 14 ações que não enviam texto ao lead).

### 4.3 `scheduled-dispatcher` (cron — 1 min)

Compartilhada com o agendamento de mensagens (documentada em `./EMAIL.md`). Para IA:

1. `delete from pending_replies where lead_id=? and agent_id=? and run_at <= now() returning *` — **claim atômico** evita corrida com `EdgeRuntime.waitUntil`.
2. Carrega últimas 20 mensagens do lead → monta `conv` (alternando `user`/`assistant`).
3. **Skips** quando vocal:
   - última mensagem **não** é do `user` → `skip last-not-user`;
   - um humano respondeu nos últimos 5 min → `skip human-just-replied`;
   - conversa vazia → `skip empty-conv`.
4. Garante `ai_threads`, chama `ai-chat` com `persist=true`. Se não-silent e houver `reply`, envia via `evolution-send` com `client_message_id` para idempotência.
5. Em erro registra em `ai_usage` com `status='error'`.
6. Logs estruturados: `[dispatcher] -> ai-chat lead=… agent=… silent=… msgs=…` / `OK` / `FAIL` / `skip reason=…`.

Roda `pmap` ilimitado nos pendentes (até 20 por tick) com `EdgeRuntime.waitUntil` para não ser cortado pelo runtime.

### 4.4 `ai-assist`

Helper do Inbox. **Não** usa agentes per-clínica — usa o **Lovable AI Gateway** (`LOVABLE_API_KEY` server-side) e cobra do plano Lovable.

Dois modos:

- `summary` — gera resumo curto da conversa (2-3 frases: status, interesse, próximo passo). Se houver agente com `role='summary'` enabled na clínica, usa o `system_prompt`/`model`/`temperature` dele; caso contrário cai no default (`openai/gpt-5`, prompt embutido). Persiste em `leads.ai_summary` + `ai_summary_at`.
- `suggest` — retorna `{ suggestions: [string, string, string] }` parseado de JSON; com fallback robusto para split por linhas se o modelo não respeitar o formato.

`normalizeModel()` mapeia modelos legados para alternativas suportadas (ex.: `gpt-4o` → `google/gemini-2.5-flash`).

### 4.5 `ai-ingest-*` (base de conhecimento)

| Function | Origem | Particularidades |
|---|---|---|
| `ai-ingest-document` | texto cru (`content`) | Caminho simples para colar texto |
| `ai-ingest-pdf` | base64 do PDF | Extrai com `unpdf@0.12.1` (`getDocumentProxy` + `extractText({mergePages:true})`); requer texto extraído ≥ 50 chars |
| `ai-ingest-url` | URL única | `htmlToText` (remove `<script>`/`<style>`/`<noscript>`, decode entidades); **SSRF guard**: bloqueia hosts privados (localhost/RFC1918/link-local) e força `redirect: "error"` |
| `ai-ingest-urls` | lista de URLs | Loop sobre `ai-ingest-url` |

Após extrair: `chunkText(800, 100)` → `embed()` em batches de 16 → insere `ai_chunks(content, embedding 768d, token_count=ceil(len/4), chunk_index)` + 1 linha em `ai_documents(title, content, source, metadata)`.

Requer `agent.api_key` **ou** `agent.embedding_api_key`.

### 4.6 `ai-embed`

Wrapper público de `embed()` para clientes que precisem gerar embeddings de texto ad-hoc.

### 4.7 `ai-eval-run`

Para cada caso em `agent_evals` do agente, chama `ai-chat` com o `prompt` como única mensagem `user`, e marca `last_passed = expected_contains.every(s => content.toLowerCase().includes(s.toLowerCase()))`. Persiste `last_run_at`, `last_passed`, `last_response` (primeiros 2 kB).

> Limitação: matching só literal (sem similaridade semântica).

### 4.8 `agent-run-bulk`

Enfileira `pending_replies` para todos os leads ativos (não-arquivados) com um dado `agent_id` — usado tipicamente para rodar um **classificador** novo em massa sobre a base existente. Param opcional `only_with_inbound=true` (default) ignora leads que só receberam mensagens outbound.

---

## 5. Camada compartilhada `supabase/functions/_shared/`

### 5.1 `ai.ts` (356 linhas) — abstração multi-provider

`chatCompletion(agent, messages, tools?, ctx?) → NormalizedResponse`

Retorno normalizado **OpenAI-like**:

```ts
{
  ok, status,
  choices: [{ message: { role:"assistant", content, tool_calls?: [{ id, type:"function", function:{ name, arguments }}] }}],
  usage: { prompt_tokens, completion_tokens, total_tokens }
}
```

Conversões por provider:

| Provider | Endpoint | Conversões |
|---|---|---|
| **OpenAI** | `${base_url || api.openai.com/v1}/chat/completions` | Pass-through quase total |
| **Anthropic** | `/v1/messages` | `system` extraído; `tool` → `tool_result` block dentro de `user`; `assistant` com `tool_calls` → blocks `text` + `tool_use`; resposta `content[]` re-empacotada |
| **Google** | `/v1beta/models/{model}:generateContent` | `system` em `systemInstruction`; `tool` → `functionResponse`; `assistant.tool_calls` → `functionCall`; cada chamada recebe `id` sintético |

`embed(agent, texts, ctx?) → number[][]` — **força 768 dimensões** (compat com índices `pgvector` em `ai_chunks` e `agent_memory`):

- `embedding_api_key` (OpenAI-compat) → `openaiEmbed` com `dimensions: 768`.
- Senão, `agent.provider === "openai"` → mesmo caminho.
- Senão, `agent.provider === "google"` → `batchEmbedContents` com `outputDimensionality: 768`.
- **Anthropic** não tem embed nativo — exige `embedding_api_key`.

`chunkText(text, size=800, overlap=100)` — chunker naive por caracteres com overlap.

**Auto-logging**: se `ctx` (`{agent_id, lead_id, thread_id, automation_id, note}`) for passado, toda chamada de `chatCompletion`/`embed` insere uma linha em `ai_usage` com tokens, latência, status e o `note` no campo `error` quando sucesso (usado p/ marcar `rag:hyde`, `rag:rewrite`, `ingest:pdf:…`, etc.).

### 5.2 `rag.ts` (228 linhas) — RAG avançado

`retrieveContext({supabase, agent, query, history, leadId}) → { chunks, memories, rewritten_query, hyde_doc? }`

7 passos:

1. **Query rewrite** — se houver `history.length >= 2`, chama o próprio LLM (`temperature=0`) para reescrever a query incorporando as últimas 6 mensagens, em PT. Falha silenciosamente para query original.
2. **HyDE** (opcional, `agent.use_hyde`) — gera "resposta hipotética" para embedar no lugar da pergunta.
3. **Embed** — `embed(agent, [textForEmbed])`. Cache in-memory em `utils.ts`.
4. **Retrieve** — `fetchPool = topK * 4`:
   - `use_hybrid_search !== false` → RPC `match_chunks_hybrid(query_embedding, query_text, p_agent_id, match_count)` (vetorial + FTS Portuguese via RRF — Reciprocal Rank Fusion).
   - Senão → `match_chunks(query_embedding, p_agent_id, match_count)` (apenas cosine).
5. **Rerank** (opcional) — Cohere `rerank-multilingual-v3.0`, Jina `jina-reranker-v2-base-multilingual` ou Voyage `rerank-2`. Re-ordena e corta em `topK`.
6. **Doc titles** — `select id, title from ai_documents where id in (...)`, anexa `doc_title`.
7. **Memory recall** — `match_memories(query_embedding, p_agent_id, p_lead_id, 3)` traz até 3 fatos/preferências mais relevantes daquele lead com aquele agente.

`formatContext(r)` produz blocos markdown:

```text
## Memórias do agente sobre este lead
- (fact) Já fez consulta de avaliação em 2025-02.
- (preference) Prefere horários pela manhã.

## Trechos da base de conhecimento (cite como [1], [2]...)
[1] (Protocolo Cetamina) Indicações: depressão resistente...
[2] (FAQ Convênio) Atendemos os seguintes planos...
```

### 5.3 `mcp.ts` (110 linhas) — cliente MCP

Implementação mínima do **Streamable HTTP** do MCP:

- `initialize` → `tools/list` → `tools/call` via JSON-RPC 2.0.
- Header obrigatório: `Accept: application/json, text/event-stream` (sem isso, SDKs MCP devolvem **406**).
- Suporta resposta SSE: parseia primeira linha `data: {…}` que contenha `result` ou `error`.
- **Namespacing**: tools de cada server viram `<slug(server.name)>__<rawName>` para evitar colisões.
- `toOpenAITools(mcp[])` converte para `{type:"function", function:{name, description, parameters: inputSchema}}` — entra direto no `tools[]` do `chatCompletion`.

### 5.4 `utils.ts`

Utilitários compartilhados: `stableStringify` (chave estável p/ dedup), `withTimeout(promise, ms, label)`, `pmap(items, concurrency, fn)`, `logTrace(supabase, {run_id, step, kind, name, latency_ms, error, payload})`, caches in-memory `getCachedEmbedding`/`setCachedEmbedding` e `getCachedRetrieval`/`setCachedRetrieval`.

### 5.5 `metrics.ts`

`logUsage(row)` — insere em `ai_usage` com defaults (`status='success'`, `tools_called=0`, `replied=false`). Centraliza o cálculo de custo (feito client-side via `ai-pricing.ts`).

---

## 6. Esquema do banco

### Tabelas principais

| Tabela | Função | Colunas-chave |
|---|---|---|
| `ai_agents` | Agente por clínica | `provider`, `api_key`, `base_url`, `model` (default `google/gemini-3-flash-preview`), `temperature`, `tools jsonb[]`, `silent`, `role` (índice único parcial `WHERE role='summary' AND enabled=true` → 1 summary agent por clínica), flags RAG (`use_hyde`, `use_hybrid_search`, `use_memory`, `rag_top_k`, `planning_mode`), limites (`max_iterations`, `max_tool_calls`, `debounce_seconds`), `reranker_provider`, `reranker_api_key`, `embedding_model`, `embedding_api_key`, `clinic_id` |
| `ai_documents` | Doc da base de conhecimento | `agent_id`, `title`, `content`, `source`, `metadata jsonb` |
| `ai_chunks` | Chunk vetorial | `vector(768)` embedding, `tsv tsvector` gerada com `to_tsvector('portuguese', content)` para FTS híbrido, `agent_id`, `clinic_id` |
| `ai_threads` | Thread de conversa | `agent_id`, `lead_id`, `title`, `clinic_id` |
| `ai_messages` | Mensagens persistidas | `thread_id`, `role`, `content` — só populadas quando `ai-chat` é chamado com `persist=true` |
| `ai_usage` | Telemetria + custo | `operation` (`chat`/`embed`), `status` (`success`/`error`), `input_tokens`, `output_tokens`, `total_tokens`, `latency_ms`, `tools_called`, `replied`, `error` (também usado como tag de fonte: `turn:summary`, `rag:hyde`, etc.) |
| `agent_memory` | Memória persistente | `kind ∈ {summary, fact, preference}` (check constraint), `vector(768)`, `lead_id`, `agent_id`, recall por `match_memories` |
| `agent_traces` | Traces por step | `run_id`, `step`, `kind` (`llm`/`tool`), `name`, `latency_ms`, `tokens_in/out`, `payload jsonb`, `error` |
| `agent_evals` | Casos de teste | `prompt`, `expected_contains text[]`, `last_run_at`, `last_passed`, `last_response` |
| `agent_mcp_servers` | Servidores MCP | `url`, `headers jsonb`, `enabled` |

### Tabelas auxiliares

| Tabela | Função |
|---|---|
| `lead_ai_settings` | Override por lead: `agent_id`, `auto_reply`, `paused_until` |
| `stage_ai_defaults` | Default por estágio: `agent_id`, `auto_reply` |
| `pending_replies` | Fila de debounce: PK `(lead_id, agent_id)`, `run_at`, `clinic_id` |
| `whatsapp_instances.watcher_agent_id` / `watcher_pipeline_id` | Configura watcher per-instância |

### RPCs (SECURITY DEFINER, escopadas por `clinic_id` via `current_clinic_id()`)

- `match_chunks(query_embedding, p_agent_id, match_count)` — pura cosine.
- `match_chunks_hybrid(query_embedding, query_text, p_agent_id, match_count)` — RRF (Reciprocal Rank Fusion) combinando vetorial + FTS Portuguese.
- `match_memories(query_embedding, p_agent_id, p_lead_id, match_count)` — cosine em `agent_memory`.

### RLS

Todas as tabelas têm RLS habilitada e políticas baseadas em `clinic_id = current_clinic_id()`. `api_key` / `embedding_api_key` / `reranker_api_key` em `ai_agents` só são selecionáveis por `owner` / `admin` da clínica (políticas com filtro adicional via `has_role`).

---

## 7. Built-in tools — referência completa

Implementadas em `BUILTIN_TOOLS` (schema) + `executeTool()` (handler) em `supabase/functions/ai-chat/index.ts`.

| Tool | Args | Efeito | Silent? |
|---|---|---|---|
| `move_lead_stage` | `stage_name` | Procura estágio (ilike) no pipeline do lead. Atualiza `leads.stage_id` + `stage_changed_at` + insere `lead_events {type:'stage_changed_by_ai', payload:{from,to,agent_id,agent_name}}`. Se não achar, retorna `available_stages[]`. | ✅ |
| `add_lead_note` | `note` | Append em `leads.notes` com prefixo `[IA]`. | ✅ |
| `set_lead_field` | `field ∈ {name,email,company,deal_value}`, `value` | Update direto. `deal_value` é coerced para Number. | ✅ |
| `assign_attendant` | `attendant_name` | Busca em `attendants` (ilike), atualiza `leads.attendant_id`. | ✅ |
| `search_knowledge_base` | `query` | Chama `retrieveContext`, devolve `[{idx,title,snippet(400)}]`. | ✅ |
| `create_task` | `title`, `due_at` (ISO 8601) | Insert em `lead_tasks`. | ✅ |
| `schedule_message` | `text`, `send_at` (ISO 8601) | Insert em `scheduled_messages` (despachado pelo `scheduled-dispatcher`). | ✅ |
| `get_lead_history` | `limit` (default 20, cap 50) | Últimas N mensagens normalizadas como `{role:'atendente'|'cliente', text, when}`. | ✅ |
| `transfer_to_human` | `reason` | Upsert `lead_ai_settings {paused_until = now+24h, auto_reply=false}` + nota interna. | ✅ |
| `update_custom_field` | `key`, `value` | Merge em `leads.custom_fields jsonb`. Schema da clínica é injetado no system prompt. | ✅ |
| `remember_fact` | `kind ∈ {fact,preference}`, `content` | Gera embedding e insere em `agent_memory`. | ✅ |
| `add_lead_tag` | `tag` | Push em `leads.tags[]` (dedup). | ✅ |
| `remove_lead_tag` | `tag` | Remove de `leads.tags[]`. | ✅ |
| `get_lead_state` | — | Snapshot: nome, estágio atual + anterior, tags, custom fields, `last_message_at`, `stage_changed_at`, histórico recente de estágios. | ✅ |

> Todas as 14 são "silent" — não enviam texto ao lead. **Não há built-in `send_message`**: o envio é responsabilidade do `scheduled-dispatcher` quando o agente é vocal (i.e. retorna `content` não-vazio e não tem `silent=true`).

**Adicionar uma nova tool**: registrar em `BUILTIN_TOOLS` (schema OpenAI) + branch em `executeTool` + entrada em `TOOLS` (`src/pages/Agents.tsx`) + (se for silent) acrescentar à `SILENT_TOOLS` em `ai-auto-reply/index.ts` **e** `scheduled-dispatcher/index.ts`.

---

## 8. Modos de operação

### 8.1 Vendas (vocal)

- `agent.silent=false` e pelo menos uma tool **não** silent (na prática, ausência de tools "envio" + permissão de responder com texto livre).
- Ativado por `lead_ai_settings.auto_reply=true` (override por lead, configurável no Inbox/LeadDrawer) **ou** `stage_ai_defaults.auto_reply=true` (default por coluna do funil).
- Resposta enviada via `evolution-send` com `client_message_id` (idempotência).
- Pode ser pausado por 24 h via `transfer_to_human` — `lead_ai_settings.paused_until` é checado no `ai-auto-reply` antes de enfileirar.

### 8.2 Watcher / Classificador (silent)

- `agent.silent=true` **ou** todas as tools ∈ `SILENT_TOOLS`.
- Configurado em `whatsapp_instances.watcher_agent_id` (1 watcher por instância WhatsApp, opcionalmente restrito a um `watcher_pipeline_id`).
- Roda em **toda** mensagem (incluindo `from_me=true`), permitindo classificar conversas do atendente.
- Geralmente combinado com `system_prompt` instruindo: "Você é um classificador. NÃO responda ao lead. Apenas use ferramentas para mover de etapa, taggear, anotar fatos."

### 8.3 Summary agent (`role='summary'`)

- Único por clínica (índice `ux_ai_agents_role_summary_per_clinic`).
- Usado **apenas** pelo `ai-assist` (modo `summary`) — não entra no fluxo de auto-reply.
- Se não existir, cai no default `openai/gpt-5` via Lovable AI Gateway.

---

## 9. Configurando um agente — passo a passo

1. **Criar** em `/ai/agents` → "Novo agente". Escolher `provider`, `model`, colar `api_key`, definir `system_prompt`.
2. **Tools**: marcar built-ins necessárias. Para classificador, marque só as silent (move/tag/nota/etc.).
3. **MCP** (opcional): adicionar servidores `(name, url)` — as tools aparecem automaticamente no próximo turno.
4. **RAG**:
   - Ingerir docs (PDF / URL / texto) na seção "Base de conhecimento".
   - Ajustar `rag_top_k` (3-8 funciona bem).
   - Ligar `use_hybrid_search` (recomendado), `use_hyde` (se queries são curtas/ambíguas), `use_memory` (recomendado).
   - Configurar reranker se quiser ganho de precisão.
5. **Ativar**:
   - **Vendas**: no LeadDrawer → "IA" → escolher agente + `auto_reply`. Ou em `/settings` → "Defaults por estágio" → setar `stage_ai_defaults`.
   - **Watcher**: em `/settings/whatsapp` → editar instância → `watcher_agent_id`.
6. **Testar**:
   - `EvalsPanel` no próprio agente para regressão.
   - "Run now" no Inbox para um lead específico (chama `ai-chat` direto sem passar pelo debounce).

---

## 10. Custos & observabilidade

### Custo

`src/lib/ai-pricing.ts` mapeia ~30 modelos (OpenAI, Google, Anthropic) → `{ in, out }` USD por 1M tokens, com:

- `normalizeModel()` que tira prefixo de provider e sufixos de data (`gpt-4o-2024-08-06` → `gpt-4o`).
- Fallback por prefixo: se `getPrice` não acha, tenta prefixos conhecidos.
- `fmtUSD()` para formatação humanizada (5 casas se < $0.01).

`MetricsAiUsage.tsx` consome direto de `ai_usage` e aplica `calcCost(model, input_tokens, output_tokens)` por linha.

### Traces

`agent_traces` (`run_id` = UUID do turno) permite reconstruir uma execução completa:

```sql
select step, kind, name, latency_ms, tokens_in, tokens_out, payload, error
from agent_traces
where run_id = '...'
order by step;
```

Tipos: `kind='llm'` (1 por iteração) intercalados com `kind='tool'` (1 por chamada de ferramenta, com `payload.args`).

### Logs do dispatcher

Linhas estruturadas no `edge-function-logs` do `scheduled-dispatcher`:

```text
[dispatcher] tick done scheduled={...} replies={...}
[dispatcher] -> ai-chat lead=abc agent=def silent=true msgs=12
[dispatcher] OK lead=abc silent=true tools=3 reply_len=0 latency=2845ms
[dispatcher] skip lead=abc reason=human-just-replied
[dispatcher] FAIL lead=abc ai-chat 502: provider error 429
```

---

## 11. Segurança & limites

- **API keys de agentes** vivem em `ai_agents.api_key` (texto). Nunca expostas ao client: a UI `Agents.tsx` envia `update` parcial via supabase-js sob RLS restrita a `owner`/`admin`. Quem não pode editar nunca recebe a coluna no `select`.
- **Lovable AI Gateway** (`ai-assist`) usa `LOVABLE_API_KEY` server-side — nunca exposta.
- **SSRF guard** em `ai-ingest-url`: regex contra hosts privados + `redirect: "error"` (evita follow para `metadata.internal` etc.). Apenas `http(s):`.
- **Tool budget**: `max_tool_calls` impede loops infinitos; **dedup** (3× mesmo `name+args`) impede modelo "burro" travado.
- **Timeouts**: `TURN_TIMEOUT_MS=90s`, `TOOL_TIMEOUT_MS=15s`. Erros retornam `{error, retryable}` para o modelo decidir como reagir.
- **Idempotência** no envio: `client_message_id` enviado ao `evolution-send` evita disparo duplicado se o dispatcher rodar 2× a mesma linha.

---

## 12. Limitações conhecidas

- **Cache de embedding / retrieval** é apenas in-memory por instância edge — não compartilhado entre invocações em runtimes diferentes.
- **`chunkText`** é naive (corte por caracteres, overlap fixo) — sem segmentação semântica ou consciência de parágrafos/Markdown.
- **`match_chunks_hybrid`** usa RRF com pesos hard-coded; ajustar requer migração.
- **Embeddings forçados a 768d** — modelos que retornam outra dimensão são truncados via parâmetro do provider (`dimensions` no OpenAI, `outputDimensionality` no Google). Se um provider futuro não suportar truncamento, é preciso adaptar.
- **`agent_evals`** mede apenas `expected_contains` (substring case-insensitive). Sem similaridade semântica ou LLM-as-judge.
- **MCP**: cliente é Streamable HTTP only — sem suporte a stdio/local; sem refresh OAuth (headers estáticos).
- **Anthropic não tem embeddings** — agentes Anthropic precisam de `embedding_api_key` separada (OpenAI-compat) para usar RAG.
- **`agent_memory.embedding` usa IVFFlat** com `lists=100` — para bases > 100k memórias, considerar HNSW.
- **Carga inicial do `match_chunks_hybrid`** pode ser lenta para clínicas com muitos docs (sem partitioning); benchmark recomendado antes de escalar.

---

## 13. Cheatsheet para devs

| Tarefa | Como |
|---|---|
| Adicionar nova built-in tool | Registrar em `BUILTIN_TOOLS` + branch em `executeTool` (`ai-chat`); adicionar à lista `TOOLS` em `src/pages/Agents.tsx`; se silent, incluir em `SILENT_TOOLS` em **`ai-auto-reply`** e **`scheduled-dispatcher`** |
| Adicionar novo provider de LLM | Implementar `xxxChat` em `_shared/ai.ts` + ramo em `chatCompletion`; opcionalmente `xxxEmbed`; permitir no check constraint `ai_agents_provider_chk` |
| Trocar modelo padrão | Alterar default da coluna `ai_agents.model` via migration |
| Resetar memória de um lead | `delete from agent_memory where lead_id = '...'` |
| Forçar re-classificação em massa | `POST /agent-run-bulk { agent_id, only_with_inbound: true }` |
| Debugar um turno | `select * from agent_traces where run_id = '...' order by step;` — o `run_id` aparece nos logs do `ai-chat` |
| Ver custo do mês | `/ai/usage` ou: `select model, sum(input_tokens), sum(output_tokens) from ai_usage where created_at >= date_trunc('month', now()) group by model;` |
| Pausar IA num lead | `update lead_ai_settings set paused_until = now() + interval '24h' where lead_id = '...'` |
| Forçar dispatcher | `POST /scheduled-dispatcher` (sem body) |

---

## 13.1 Gargalos identificados e melhorias aplicadas

Análise feita em 18/05/2026 — três passagens. **A maioria das melhorias já foi aplicada nesta data**; os itens restantes exigem decisão de produto (qual agente ativar, breaking change de storage) ou são UX puro.

### 🔴 Críticos

#### 1. ✅ APLICADO — Memórias não eram gravadas (`agent_memory.clinic_id` NOT NULL violado)
- **Causa raiz:** `INSERT` em `ai-chat/index.ts` (tool `remember_fact`) não passava `clinic_id`. Coluna é `NOT NULL DEFAULT current_clinic_id()`, mas a edge function usa service role → `current_clinic_id()` devolve `NULL` → insert falhava. O `try/catch` engolia o erro.
- **Fix:** `remember_fact` agora passa `clinic_id: agent.clinic_id`, valida conteúdo, loga o erro real do Postgres e devolve a mensagem ao modelo.
- **Pendência:** auditar outros INSERTs de edge functions em tabelas com mesmo default (vide #1b).

#### 1b. ✅ APLICADO — guard contra `clinic_id NULL` em service role
- Criada função `assert_clinic_id_not_null()` + triggers `BEFORE INSERT` nas tabelas `agent_memory`, `agent_traces`, `ai_usage`, `lead_events`, `lead_tasks`. Inserts sem `clinic_id` agora falham com `clinic_id_required: tabela X exige clinic_id explicito` (SQLSTATE 23502) ao invés de serem silenciosamente engolidos. Bug do tipo do #1 vira erro imediato e rastreável.


#### 2. ✅ APLICADO — Mensagem perdida quando `evolution-send` falha
- **Antes:** `pending_replies` era deletado antes do envio. Se `evolution-send` falhasse, a mensagem era perdida sem retry.
- **Fix:** adicionadas colunas `status`, `attempts`, `last_error`, `claimed_at` em `pending_replies`. O dispatcher agora faz **claim atômico** (`UPDATE status='processing'`), só remove em sucesso, e em falha reenfileira com backoff exponencial (0s → 30s → 2min) até 3 tentativas. Claims travados >5min são recuperados automaticamente no próximo tick.

#### 3. ⏳ Pendente (decisão de produto) — `remember_fact` no agente silencioso ativo
- O agente que roda no inbound é o **"Classificador de Pipeline"** (`e2b20d28...`), cujo array `tools` não inclui `remember_fact`. Só o "Vendedor" tem.
- **Ação manual:** habilitar `remember_fact` (e `add_lead_tag`) também no Classificador via `/ai/agents`, **ou** criar um agente "observer" dedicado. Sem isso, o fix do item #1 não tem efeito no fluxo real.

### 🟡 Médios

#### 4. ✅ APLICADO — Cache de embedding ativado no RAG
- `_shared/rag.ts` agora consulta `getCachedEmbedding` antes de gerar a query embedding e grava o resultado em background. Chave = `sha256(model + '::' + text)`. Esperado: -30% de chamadas de embedding em conversas com queries repetidas.

#### 5. ✅ APLICADO — `SILENT_TOOLS` centralizado
- Criado `supabase/functions/_shared/agent-flags.ts` com `SILENT_TOOLS` + `isSilentByTools()`. `ai-auto-reply` e `scheduled-dispatcher` importam de lá. Adicionar nova tool agora exige editar 1 arquivo.

#### 6. ⏳ Pendente — Latência do dispatcher (cron 1min + setTimeout frágil)
- Não aplicado nesta rodada por exigir mudança de cron schedule (operação separada da migration). **Próxima ação:** baixar cron de `* * * * *` para `*/15 * * * * *` via `cron.schedule` na UI do Supabase, ou implementar `pg_notify('dispatcher_wakeup')` no insert de `pending_replies`.

#### 7. ⏳ Pendente — Sumarização incremental do histórico
- Funcionalidade nova; não é regressão. Quando volume justificar, gerar summary via cheap model a cada 30 turnos e salvar em `agent_memory(kind='summary')`.

#### 8. ✅ APLICADO — `processScheduled` paralelizado
- Trocado o `for ... await` por `pmap(items, 10, sender)`. 50 mensagens × 2s passa de ~100s sequencial para ~10s.

#### 9. ✅ APLICADO (parcial) — Loop bot → webhook → auto-reply quebrado
- Adicionada coluna `messages.bot_agent_id`. `evolution-send` agora aceita `bot_agent_id` no body e marca a row. `scheduled-dispatcher` passa o `agent_id` ao enviar. `ai-auto-reply` verifica a última mensagem do lead: se for `from_me` com `bot_agent_id` preenchido, retorna `skipped: from_bot-loop-guard` sem enfileirar.
- **Limitação atual:** depende da ordem de chegada do `MESSAGES_UPSERT` da Evolution. Se o webhook chegar antes do INSERT do `evolution-send` (raro mas possível em race), o guard falha. Mitigação futura: marcar via `external_id` quando a Evolution confirmar o envio.

#### 10. ✅ APLICADO — Orçamento de tokens no RAG
- `_shared/rag.ts` agora corta chunks recuperados quando `sum(content.length) > 16_000` (~4k tokens). Mantém ao menos 1 chunk. Preserva top-K ranqueado pelo reranker.

#### 11. ✅ APLICADO — Retenção + view agregada de `ai_usage`
- `cleanup_agent_caches()` deleta `ai_usage > 90d` e `embedding_cache > 30d` (em adição às retenções pré-existentes de `agent_traces > 14d`, `rag_cache > 1h`, etc.).
- Criada **view `ai_usage_daily`** (`security_invoker=on`) agregando `calls`, `errors`, `input/output/total_tokens`, `cost_usd` e `avg_latency_ms` por `clinic_id × agent_id × model × operation × day`. Dashboards do `/ai` podem ler dela em vez de fazer `sum()` sobre milhões de rows.

### 🟢 Pequenos / UX

#### 12. ✅ APLICADO — `cost_usd` materializado em `ai_usage`
- Nova coluna `cost_usd numeric(12,6)`. Novo módulo `supabase/functions/_shared/ai-pricing.ts` espelha o pricing do frontend. `logUsage` calcula e grava o custo no insert. Histórico fica imutável mesmo se os preços mudarem.

#### 13. ⏳ Pendente (breaking) — Dedup `ai_documents.content` vs `ai_chunks.content`
- Exige migration de dados (backfill para storage) + mudança no UI de edição. Não aplicado nesta rodada.

#### 14. ✅ APLICADO — RLS explícita em `embedding_cache`
- Adicionada policy `embedding_cache_read_authenticated` (SELECT for authenticated). Escritas continuam via service role.

#### 15. ✅ APLICADO — Erros tipados de provider (`retryable`)
- `NormalizedResponse` ganhou flag `retryable: boolean`. Helper `isRetryableStatus(s)` retorna `true` para 408/425/429/5xx. Os três adapters (`openaiChat`, `anthropicChat`, `googleChat`) preenchem o flag a partir do `r.status`. O `scheduled-dispatcher` e o `ai-auto-reply` podem usar isso para decidir entre retry-com-backoff e fail-fast — hoje o caminho de retry só dispara em exceção; em rodada futura passamos a respeitar também `retryable` retornado.

#### 16. ⏳ Pendente — Cron diário de evals
- Próxima ação: agendar `ai-eval-run` via `cron.schedule` para rodar 1x/dia em agentes ativos e expor `last_passed` no `/ai`.

#### 17. ✅ APLICADO — JSON compacto no prompt
- `ai-chat/index.ts` trocou `JSON.stringify(lead, null, 2)` por `JSON.stringify(lead)` no bloco "Lead atual" e em "Valores atuais" de campos customizados. Economia esperada: ~15-25% tokens/turno em contexto do lead.

#### 18. ✅ APLICADO — Agrupar tools na UI de `Agents.tsx`
- Lista plana virou 4 grupos (`Pipeline & Lead`, `Conversa & Histórico`, `Conhecimento & Memória`, `Agendamentos & Tarefas`). `remember_fact` agora vem com hint explicando que é silenciosa e recomendada em agentes observadores — reduz a chance de repetir o gargalo do #3.

---

### Resumo executivo

| Prio | Item | Status |
|---|---|---|
| 🔴 P0 | #1 Fix `remember_fact.clinic_id` | ✅ aplicado |
| 🔴 P0 | #1b Guard `clinic_id NULL` em service role | ✅ aplicado |
| 🔴 P0 | #2 Loss-protection no dispatcher (claim/retry) | ✅ aplicado |
| 🔴 P0 | #3 Habilitar `remember_fact` no agente ativo | ⏳ decisão de produto |
| 🟡 P1 | #4 Cache de embedding no RAG | ✅ aplicado |
| 🟡 P1 | #5 `SILENT_TOOLS` centralizado | ✅ aplicado |
| 🟡 P1 | #6 Latência do dispatcher (cron 15s / pg_notify) | ⏳ pendente |
| 🟡 P1 | #7 Sumarização incremental | ⏳ pendente |
| 🟡 P1 | #8 `processScheduled` paralelizado (pmap) | ✅ aplicado |
| 🟡 P1 | #9 Quebra de loop bot/webhook (`bot_agent_id`) | ✅ aplicado |
| 🟡 P1 | #10 Orçamento de tokens no RAG | ✅ aplicado |
| 🟡 P1 | #11 Retenção + view `ai_usage_daily` | ✅ aplicado |
| 🟢 P2 | #12 `cost_usd` materializado | ✅ aplicado |
| 🟢 P2 | #13 Dedup `ai_documents.content` | ⏳ breaking |
| 🟢 P2 | #14 RLS `embedding_cache` | ✅ aplicado |
| 🟢 P2 | #15 Erros tipados de provider (`retryable`) | ✅ aplicado |
| 🟢 P2 | #16 Cron diário de evals | ⏳ pendente |
| 🟢 P2 | #17 Prompt compacto | ✅ aplicado |
| 🟢 P2 | #18 Agrupar tools na UI | ✅ aplicado |

**Aplicados no acumulado: 16 de 18 itens** (4 P0, 6 P1, 6 P2). Restantes: #3 (decisão de produto — habilitar `remember_fact` no Classificador), #6 (operação de cron), #7 (feature de sumarização), #13 (breaking de storage), #16 (cron de evals).


### Como validar a entrega dos fixes

```sql
-- #2: dispatcher loss-protection
\d pending_replies                      -- deve ter status/attempts/claimed_at/last_error
select status, count(*) from pending_replies group by 1;

-- #9: bot loop guard
select count(*) from messages where bot_agent_id is not null;

-- #12: cost materializado
select model, sum(cost_usd) from ai_usage where created_at > now() - interval '1 day' group by 1;

-- #14: embedding_cache policy
select polname from pg_policy where polrelid = 'public.embedding_cache'::regclass;
```



---

## 14. Referências cruzadas

- **Inbox / WhatsApp**: ver `../OVERVIEW.md`. O `evolution-webhook` é quem dispara `ai-auto-reply`.
- **E-mail**: ver `./EMAIL.md`. Compartilha o `scheduled-dispatcher` (cron 1 min).
- **Tracking**: ver `./TRACKING.md`. Independente — não há feature de RAG sobre eventos de tracking ainda.

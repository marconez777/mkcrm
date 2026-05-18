## Plano — `docs/AI.md`

Documento técnico (8–10 páginas) que cobre o módulo de Inteligência Artificial do CRM: agentes multi-provider, RAG avançado, ferramentas, MCP, auto-reply com debounce, memória, traces, evals e custos.

### Estrutura proposta

**1. Visão geral**
- O que é: agentes IA por clínica que conversam, classificam, executam ações no CRM (mover estágio, tags, tarefas, agendar mensagens) e consultam base de conhecimento via RAG.
- Multi-provider: OpenAI, Anthropic, Google — chave por agente.
- Dois modos: **vocal** (responde ao lead) e **silent / watcher** (apenas usa tools, não envia mensagem).
- Stack: 10 edge functions (`ai-chat`, `ai-auto-reply`, `ai-assist`, `ai-eval-run`, `ai-embed`, `ai-ingest-pdf|url|urls|document`, `agent-run-bulk`) + `scheduled-dispatcher` (cron) + 10 tabelas Postgres.

**2. Arquitetura (diagrama em ASCII)**
- Fluxo inbound: `evolution-webhook` → `ai-auto-reply` (debounce) → `pending_replies` → `scheduled-dispatcher` (cron 1 min) → `ai-chat` → `evolution-send`.
- Fluxo manual: UI `/inbox` → `ai-assist` (Lovable Gateway) ou `ai-chat`.
- Fluxo ingest: UI Agents → `ai-ingest-*` → embeddings 768d → `ai_chunks`.

**3. Telas (frontend)**
- `/ai` `AiHub` + abas (`AiDashboard`, `Agents`, `AgentMemories`, `Messages` ⇒ Sequências/Automações/Templates, `Broadcasts`, `MetricsAiUsage`).
- `AiDashboard.tsx` — KPIs (mensagens 7d, tokens 30d, agentes/automações ativos) + gráfico de barras 7d a partir de `ai_usage`.
- `Agents.tsx` — CRUD de agentes; painéis `McpServersPanel` e `EvalsPanel`; documentos da base (upload PDF/URL/texto); seletor de tools, modelo, temperatura, RAG (top_k, HyDE, hybrid, memory), reranker, planning_mode, max_iterations, max_tool_calls, debounce, silent, role (`summary`).
- `AgentMemories.tsx` — visualizador global de `agent_memory` com filtros por agente/kind/busca, link para o lead.
- `MetricsAiUsage.tsx` — custo por modelo via `src/lib/ai-pricing.ts` (USD por 1M tokens), agregações por período/agente/operação.

**4. Edge Functions detalhadas**

- **`ai-chat`** (núcleo, 545 linhas):
  - Loop de até `max_iterations` (default 6, cap 12).
  - Carrega `system_prompt` + `planning` prefix + contexto do lead (campos, estágio atual, **lista de estágios disponíveis**, custom fields schema com tipo/opções e valores atuais) + `ragContext` + instrução de citar `[1], [2]`.
  - **14 built-in tools**: `move_lead_stage`, `add_lead_note`, `set_lead_field`, `assign_attendant`, `search_knowledge_base`, `create_task`, `schedule_message`, `get_lead_history`, `transfer_to_human` (pausa 24 h via `lead_ai_settings.paused_until`), `update_custom_field`, `remember_fact` (embed+insert em `agent_memory`), `add_lead_tag`, `remove_lead_tag`, `get_lead_state`.
  - **MCP tools**: lista `agent_mcp_servers.enabled=true` → `listMcpTools` → expõe como `<server>__<tool>` ao LLM.
  - Hardening: timeouts `TURN_TIMEOUT_MS=90s`, `TOOL_TIMEOUT_MS=15s`, paralelismo `pmap(4)`, **detecção de chamada duplicada** (>= 3 vezes mesmo `name+args` → bloqueia), orçamento `max_tool_calls` com mensagem de "produza resposta final".
  - Modo *manual review*: se `lead_id` sem `messages`, monta transcript das últimas 30 mensagens e passa como turno único.
  - Persistência opcional em `ai_threads` + `ai_messages`; trace por step em `agent_traces` (`kind: llm|tool`, latency, tokens, payload); `ai_usage` por iteração (via `chatCompletion(ctx)`) + linha resumo `turn:summary`.

- **`ai-auto-reply`** (debounce):
  - Trigger pelo `evolution-webhook` em cada inbound/outbound.
  - Enfileira **watcher** (silent agent da `whatsapp_instances.watcher_agent_id`, opcionalmente restrito a `watcher_pipeline_id`) — roda inclusive em `from_me=true`.
  - Enfileira **sales agent** via `lead_ai_settings` (override por lead) ou `stage_ai_defaults` (default por estágio) — pula se `from_me=true` e agente não-silent, pula se `paused_until > now`.
  - Upsert em `pending_replies (lead_id, agent_id, run_at, clinic_id)` com `run_at = now + debounce_seconds`. **Bursts** estendem o `run_at` (não duplicam).
  - `EdgeRuntime.waitUntil` agenda fetch ao `scheduled-dispatcher` após o debounce para não depender só do cron.

- **`scheduled-dispatcher`** (cron 1 min — documentado também no doc de e-mail):
  - Faz `delete … returning` em `pending_replies` (claim atômico), chama `ai-chat` com `persist=true`, se não-silent e houver `reply` envia via `evolution-send`. Skip quando última msg não é do user, ou se humano respondeu nos últimos 5 min.

- **`ai-assist`** (Lovable AI Gateway):
  - Modos `summary` (usa agente `role='summary'` da clínica se existir, default `openai/gpt-5`, salva em `leads.ai_summary`) e `suggest` (3 respostas curtas em JSON).
  - Normaliza modelo (`normalizeModel`) para evitar legados não suportados pelo gateway.

- **`ai-ingest-pdf` / `ai-ingest-url` / `ai-ingest-urls` / `ai-ingest-document`**:
  - Extrai texto (`unpdf` para PDF, sanitização HTML para URL com SSRF guard `PRIVATE_HOST_RE` e `redirect: error`).
  - `chunkText(800, 100)` → `embed(agent, batch)` em lotes de 16 → insere `ai_chunks` (768 dims) + `ai_documents`.

- **`ai-embed`** — wrapper público da função `embed`.

- **`ai-eval-run`** — roda todos `agent_evals` do agente, chama `ai-chat`, marca `last_passed = expected_contains.every(includes)`.

- **`agent-run-bulk`** — enfileira `pending_replies` para todos os leads ativos (opcionalmente só com inbound) para rodar o classificador/vigia em massa.

**5. Camada compartilhada `_shared/`**

- **`ai.ts`** — abstração multi-provider:
  - `chatCompletion(agent, msgs, tools?, ctx?)` → resposta normalizada estilo OpenAI (incl. `tool_calls`); converte payload e parses de retorno para Anthropic (`tool_use`/`tool_result`) e Google (`functionCall`/`functionResponse`).
  - `embed()` força 768 dimensões (compat com índices `pgvector` em `ai_chunks` e `agent_memory`); usa `embedding_api_key` OpenAI-compat se fornecida, senão nativo do provider; Anthropic não suporta embed nativo.
  - `chunkText(size=800, overlap=100)`.
  - Auto-logging em `ai_usage` via `logUsage` quando `ctx` é passado.

- **`rag.ts`** — RAG avançado em 7 passos:
  1. `rewriteQuery` (LLM, temp 0, usa últimas 6 mensagens).
  2. `hydeAnswer` opcional (`use_hyde`).
  3. `embed` (com cache em `utils.ts`).
  4. Retrieve híbrido (`match_chunks_hybrid` RRF) ou só vetorial (`match_chunks`), `fetchPool = topK * 4`.
  5. `rerank` opcional (Cohere `rerank-multilingual-v3.0`, Jina `jina-reranker-v2-base-multilingual`, Voyage `rerank-2`).
  6. Anexa `doc_title` via lookup em `ai_documents`.
  7. `match_memories` (recall em `agent_memory` por lead).
  - `formatContext` produz markdown com "## Memórias do agente sobre este lead" e "## Trechos da base de conhecimento".

- **`mcp.ts`** — cliente MCP Streamable HTTP mínimo: `initialize` + `tools/list` + `tools/call`, suporta SSE, namespaca ferramentas como `<server>__<tool>`, converte para schema OpenAI.

- **`utils.ts`** — `stableStringify`, `withTimeout`, `pmap`, `logTrace`, caches in-memory (embedding e retrieval).

- **`metrics.ts`** — `logUsage()` (insert em `ai_usage`).

**6. Esquema do banco**

| Tabela | Função | Pontos-chave |
|---|---|---|
| `ai_agents` | agente por clínica | `provider`, `api_key`, `model` (default `google/gemini-3-flash-preview`), `temperature`, `tools jsonb[]`, `silent`, `role` (único `summary` por clínica), flags RAG (`use_hyde`, `use_hybrid_search`, `use_memory`, `rag_top_k`, `planning_mode`), `max_iterations`, `max_tool_calls`, `debounce_seconds`, `reranker_*` |
| `ai_documents` | doc da base | `agent_id`, `title`, `content`, `source`, `metadata` |
| `ai_chunks` | chunk vetorial | `vector(768)`, coluna gerada `tsv tsvector('portuguese')` para FTS híbrido, RLS por `clinic_id` |
| `ai_threads` / `ai_messages` | histórico opcional | escritos só se `persist=true` |
| `ai_usage` | custo/telemetria | `operation` (`chat`/`embed`), `status`, tokens, `latency_ms`, `tools_called`, `replied`, linha extra `error='turn:summary'` por turno |
| `agent_memory` | memória persistente | `kind ∈ {summary,fact,preference}`, `vector(768)`, recall por lead via `match_memories` |
| `agent_traces` | traces por step | `run_id`, `step`, `kind` (`llm`/`tool`), `latency_ms`, payload |
| `agent_evals` | testes de regressão | `prompt`, `expected_contains[]`, `last_passed` |
| `agent_mcp_servers` | servidores MCP | `url`, `headers`, `enabled` |
| `lead_ai_settings` | override por lead | `agent_id`, `auto_reply`, `paused_until` |
| `stage_ai_defaults` | default por estágio | herdado quando o lead não tem override |
| `pending_replies` | fila de debounce | PK `(lead_id, agent_id)`, `run_at`, `clinic_id` |

**RPCs** (SECURITY DEFINER, escopadas por `clinic_id`): `match_chunks`, `match_chunks_hybrid` (RRF), `match_memories`. RLS por `clinic_id` em todas as tabelas; `current_clinic_id()` resolve via `auth.uid()`.

**7. Tools — referência completa**
Tabela com nome → ação → parâmetros → efeitos colaterais (insert em `lead_events`, `lead_internal_notes`, etc.).

**8. Modos de operação**
- **Vendas (vocal)**: responde no WhatsApp; ativado por `lead_ai_settings.auto_reply=true` ou `stage_ai_defaults.auto_reply=true`. Pode ser pausado por 24h via `transfer_to_human`.
- **Watcher / Classificador (silent)**: detectado por `agent.silent=true` ou por **todas** as tools selecionadas serem `SILENT_TOOLS`. Roda em mensagens do atendente também. Configurado em `whatsapp_instances.watcher_agent_id`/`watcher_pipeline_id`.
- **Summary agent (`role='summary'`)**: usado pelo `ai-assist` para resumos do lead.

**9. Configuração de um agente — passo a passo dev**
1. Criar em `/ai/agents` — escolher provider, modelo, API key, `system_prompt`.
2. Selecionar tools (built-in) + servidores MCP.
3. RAG: ingerir docs, ajustar `rag_top_k`, ligar `use_hyde`/`use_hybrid_search`, configurar reranker.
4. Ativar como sales (em `/lead/:id` ou `/settings` → defaults por estágio) ou como watcher (em `/settings/whatsapp`).
5. Testar via `EvalsPanel` ou “Run now” no inbox.

**10. Custos & observabilidade**
- `src/lib/ai-pricing.ts` mapeia preços por modelo (in/out por 1M tokens) com fallback por prefixo; `MetricsAiUsage.tsx` agrega.
- `agent_traces` permite reconstruir um turno completo (LLM steps + tool steps com payload).
- Logs do dispatcher: `[dispatcher] -> ai-chat lead=…` / `OK` / `FAIL` / `skip reason=…`.

**11. Segurança & limites**
- API keys de agentes ficam em coluna `text` (server-only; nunca expostas ao client — Agents.tsx só envia delta via supabase-js sob RLS de owner/admin).
- SSRF guard em `ai-ingest-url`.
- Lovable AI Gateway no `ai-assist` usa `LOVABLE_API_KEY` server-side.
- Tool call dedup, timeouts, budgets.

**12. Limitações conhecidas**
- Cache de embedding/retrieval só por instância edge (não compartilhado).
- `chunkText` é naive (char-based), sem segmentação semântica.
- `match_chunks_hybrid` usa RRF com pesos fixos.
- Embeddings forçados a 768 dims (precisa truncar / pad em modelos que retornam outro tamanho — implementado via param `dimensions`/`outputDimensionality`).
- `agent_evals` mede só `expected_contains` (sem similaridade semântica).

**13. Cheatsheet para devs**
- Adicionar nova tool built-in: registrar em `BUILTIN_TOOLS` + branch em `executeTool` + adicionar à lista `TOOLS` em `Agents.tsx` + (se silent) à `SILENT_TOOLS` em `ai-auto-reply` e `scheduled-dispatcher`.
- Adicionar novo provider: implementar `xxxChat` em `_shared/ai.ts` e ramo em `chatCompletion`; eventualmente `xxxEmbed`.
- Mudar modelo padrão: `ai_agents.model` default.
- Reset memória de um lead: `delete from agent_memory where lead_id=…`.

### Saída
Um único arquivo `docs/AI.md` em português. Sem alterações em código.
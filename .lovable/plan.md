
## Diagnóstico — o que a comunidade reporta

Sintetizei os padrões recorrentes em Reddit (r/Rag, r/AI_Agents, r/LLMDevs), Towards Data Science, Claude Lab, Gemini Lab, NVIDIA Dynamo e issues de bots WhatsApp open-source:

**Top falhas em produção (agentes):**
1. **Tool storms / 100th-tool-call problem** — agente entra em loop chamando a mesma ferramenta, esgota tokens e custo.
2. **Context bloat** — histórico cresce, latência sobe linearmente, modelo "esquece" o início.
3. **Retrieval thrash** — RAG retorna chunks irrelevantes, agente re-busca, ciclo.
4. **Partial failure em parallel tools** — uma tool falha, agente não sabe e responde como se tivesse sucesso.
5. **WhatsApp echo loop** — webhook reentra com `fromMe`, bot responde a si mesmo (issue #53386 do openclaw, etc.).
6. **Webhook redelivery** — Evolution reenvia mesmo `external_id` em reconexão → execuções duplicadas + 429 em cascata.
7. **Reranker que piora** — adicionar Cohere sem tuning piorou latência de 80→280ms sem ganho de qualidade (post BSWEN).
8. **Long-running timeouts** — edge function morre em 60s; agentes longos precisam de retomada.
9. **Embeddings caros** — re-embedar mesma query 100×/min sem cache.
10. **Streaming quebrado** — buffering de SSE em `\n\n` corta JSON multi-chunk.

---

## Plano de hardening

### 0. Bug-fix imediato (`src/pages/Agents.tsx`)
- Linha ~497: falta `<AccordionItem value="tools" className="...">` antes do `<AccordionTrigger>` de "Ferramentas". Compilação está quebrando. Vou abrir o item corretamente.

### 1. Anti-loop & tool budget (`ai-chat`)
Inspirado no "100th tool call problem":
- **Tool budget global** por turno (default 12 chamadas, configurável `max_tool_calls`). Excedeu → forçar `tool_choice: "none"` e pedir resposta final.
- **Detecção de repetição**: se mesma `(tool_name, args_hash)` ocorrer ≥ 3× → injetar mensagem de sistema "essa tool já foi chamada com esses args, use o resultado anterior" e bloquear nova execução idêntica.
- **Token budget**: somar tokens de entrada por iteração; ao passar 80% do contexto do modelo, comprimir histórico (resumo dos turnos antigos via gemini-flash-lite) — evita context bloat.
- **Cancellation**: `AbortController` propagado, timeout duro de 90s por turno; salvar estado parcial em `agent_runs` para retomada.

### 2. Parallel tools com partial-failure handling
Padrão do Claude Lab / Gemini Lab:
- `Promise.allSettled` (não `Promise.all`) para tool calls paralelas.
- Cada tool tem timeout próprio (default 15s).
- Resultado de tool com erro vira mensagem `tool` com `{ "error": "...", "retryable": bool }` — modelo vê e decide.
- Concorrência limitada (semaphore=4) para não estourar rate limit do Evolution/MCP.

### 3. RAG: prevenir thrash e custo
Lições dos posts de pgvector + reranker:
- **Cache de embeddings**: tabela `embedding_cache (text_hash, model, embedding)` — query rewrite + HyDE re-usam.
- **Cache de retrieval**: `rag_cache (agent_id, query_hash, chunks jsonb, created_at)` TTL 10min — mesma pergunta dentro da janela não re-busca.
- **Reranker condicional**: só re-rankear se `top_score - bottom_score < threshold` (resultados ambíguos). Senão, skip — economiza 200ms.
- **HyDE com fallback**: se HyDE timeout >2s, cair para query original (não bloquear).
- **Filtro mínimo de score**: descartar chunks com score < 0.3 antes do rerank.
- **Telemetria**: gravar em `ai_usage` `retrieval_score_top1`, `retrieval_score_topk`, `chunks_used_in_answer` (parsed das citações `[n]`) → identificar thrash.

### 4. Anti-loop WhatsApp (`evolution-webhook` + `ai-auto-reply`)
Padrões dos issues do openclaw:
- **Idempotency hard-stop**: já temos `(lead_id, external_id)` único; adicionar SELECT antes do enqueue de `pending_replies` — se mensagem já processada, ignorar.
- **fromMe filter reforçado**: nunca enfileirar reply para mensagem com `from_me=true` OU cujo `external_id` esteja no set `recently_sent_by_bot` (cache em memória 60s).
- **Bot self-cooldown**: por lead, se o bot mandou mensagem nos últimos 3s, ignorar webhooks novos do próprio número até a janela passar.
- **Max replies por lead/hora**: rate limit por lead (default 30/h) — para conter loop catastrófico.
- **Webhook dedup**: tabela `webhook_dedup (event_hash, expires_at)` com TTL 5min para evitar redelivery duplo do Evolution.

### 5. Observabilidade & evals
- **Tracing por turno**: tabela `agent_traces` (`run_id, step, kind, latency_ms, tokens_in, tokens_out, payload jsonb`). UI nova "Traços" mostra cascata de tools, tempo de cada etapa, fontes RAG citadas.
- **Health dashboard** no Agents.tsx: por agente, últimas 24h → p50/p95 latência, % de turnos com tool error, taxa de evals passando, custo estimado.
- **Alertas**: se loop detectado (regra do item 1), gravar `agent_incidents` e exibir badge vermelho na sidebar do agente.

### 6. Streaming robusto no Playground
- Refatorar parser SSE seguindo o guia oficial (line-by-line, lidar CRLF, `[DONE]`, comentários `:`, JSON parcial). Já temos no `_shared/ai.ts` mas o playground ainda usa modo bloqueante.
- Mostrar tool calls em tempo real (badges no chat) + chunks RAG com hover.
- `AbortController` no botão "Parar".

### 7. Defaults seguros baseados em benchmarks
- `max_iterations`: 6 (estava 5).
- `max_tool_calls`: 12.
- `rag_top_k`: 5; `fetch_pool`: 20 (4×).
- `debounce_seconds`: 8 (mantém).
- `reranker`: desligado por padrão (ativar só quando evals mostrarem ganho).
- `temperature`: 0.3 para agentes operacionais (era 0.7 — alta T amplifica hallucination em tool calling).

---

## Arquivos a alterar

```text
src/pages/Agents.tsx            -- fix JSX + nova aba "Traços/Saúde"
supabase/functions/ai-chat/index.ts        -- tool budget, dedup, allSettled, compressão de contexto
supabase/functions/_shared/rag.ts          -- cache de embed/retrieval, reranker condicional
supabase/functions/_shared/ai.ts           -- helper de cache + dedup hash
supabase/functions/ai-auto-reply/index.ts  -- self-cooldown, rate limit por lead, dedup webhook
supabase/functions/evolution-webhook/index.ts -- webhook_dedup
supabase/migrations/<novo>.sql             -- tabelas: embedding_cache, rag_cache, agent_traces,
                                              agent_incidents, webhook_dedup, lead_reply_counters
                                              + colunas: max_tool_calls em ai_agents
```

---

## Detalhes técnicos chave

**Hash determinístico para cache** (Deno):
```ts
const hash = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
};
```

**Loop detection**:
```ts
const seen = new Map<string, number>();
const key = `${tool}:${stableStringify(args)}`;
seen.set(key, (seen.get(key) ?? 0) + 1);
if (seen.get(key)! >= 3) return { error: "duplicate_call_blocked" };
```

**Bot self-cooldown** (em memória + fallback DB):
```ts
const lastBotSentAt = await redis_or_table.get(`bot:lead:${leadId}`);
if (lastBotSentAt && Date.now() - lastBotSentAt < 3000) return; // ignora
```

**Compressão de contexto** quando >80% do limite:
- Pegar primeiros N-6 turnos, rodar `summarize` com gemini-flash-lite, substituir por uma única `system: "Resumo até aqui: ..."`.

---

## Ordem de execução (1 entrega)

1. Fix JSX em `Agents.tsx` (5 linhas).
2. Migration: novas tabelas + coluna `max_tool_calls`.
3. `_shared/ai.ts`: hash + cache helpers.
4. `_shared/rag.ts`: cache de embed/retrieval, reranker condicional, score floor.
5. `ai-chat`: tool budget, dedup, `allSettled`, timeouts, compressão de contexto, traces.
6. `evolution-webhook`: dedup.
7. `ai-auto-reply`: self-cooldown, rate limit, dedup.
8. UI: aba "Saúde / Traços" no Agents (p50/p95, tool errors, custo).
9. Sanity test via curl_edge_functions.

Aprove para eu aplicar tudo numa rodada.

---
title: SHARED_HELPERS — `supabase/functions/_shared/`
topic: inbox
kind: reference
audience: agent
updated: 2026-06-07
summary: "Constantes/exports principais:"
---
# SHARED_HELPERS — `supabase/functions/_shared/`

> Última atualização: 2026-06-03
> **14 módulos `.ts` + 1 diretório de KB (`builder-knowledge/`)** — reutilizados por TODAS as edge functions.
> Regra: lógica usada por ≥2 funções vai para cá. Nunca duplique CORS, RPC de spend-guard, helpers do Evolution etc.

## Visão geral

| Arquivo | Propósito |
|---|---|
| `utils.ts` | Hashing, dedup, timeouts, semáforo, cache de embeddings, dedup de webhooks |
| `evolution.ts` | Cliente Evolution API + CORS + auth + ingestão de mensagens |
| `ai.ts` | Cliente multi-provider (OpenAI/Anthropic/Google) chat + embeddings + auto-log |
| `rag.ts` | Query rewrite, HyDE, busca híbrida (RRF), reranker, memórias |
| `email.ts` | CORS de email + render de template `{{var}}` + sanitize tags + detector de contexto interno |
| `spend-guard.ts` | Gate de gasto de IA por clínica (RPC `check_ai_spend_status`) |
| `metrics.ts` | `logUsage(ctx, model, tokens, cost, ...)` → grava em `ai_usage` |
| `ai-pricing.ts` | Tabela de preços por modelo (USD/1M tokens in/out) |
| `agent-flags.ts` | `SILENT_TOOLS` + `isSilentByTools()` (auto-reply vs ferramentas mudas) |
| `mcp.ts` | Cliente MCP (Model Context Protocol) para tools externas |
| `attribution.ts` | UTM → canal (normaliza `traffic_source_rules`) |
| `template-vars.ts` | Resolução de variáveis `{{...}}` em templates de mensagem (lead, custom_fields, clínica) compartilhada por broadcast/sequence/scheduled-dispatcher |
| `builder-system-prompt.ts` | System prompt do **ai-builder** (copilot do `/ai/agents/new`) + `LEAD_CONTEXT_CLAUSE` injetada/validada em system prompts gerados |
| `types.ts` | Tipos compartilhados (mensagens, leads, intents) |
| `builder-knowledge/` *(dir)* | Coleção de markdowns (`best-practices.md`, ...) carregada pelo `ai-builder` como base de conhecimento do construtor de agentes |

---

## `utils.ts`

```ts
sha256Hex(s): Promise<string>                        // SHA-256 hex
stableStringify(v): string                           // JSON com chaves ordenadas (determinístico)
withTimeout(p, ms, label?): Promise<T>               // hard timeout
pmap(items, limit, fn): Promise<R[]>                 // map com concorrência limitada
isWebhookDuplicate(key, ttlSec?): Promise<bool>      // webhook_dedup table
getCachedEmbedding(text, model): Promise<vec|null>   // embedding_cache table (30d TTL)
setCachedEmbedding(text, model, vec): Promise<void>
```

**Uso**: `evolution-webhook`, `ai-chat`, `ai-auto-reply`, `rag.ts`.

**Pegadinhas:**
- `stableStringify` é OBRIGATÓRIO ao hashear args de tool calls (ordem de chaves importa).
- `isWebhookDuplicate` é o ÚNICO mecanismo de idempotência cross-function — não substitua por checks ad hoc.

---

## `evolution.ts`

Constantes/exports principais:

```ts
corsHeaders                                          // CORS padrão
json(body, status=200)                               // helper de Response JSON
sb()                                                 // supabase client (service role)
requireUser(req): string | Response                  // valida JWT, aceita service_role
loadInstance(id?): Promise<Instance | null>          // carrega instância (id ou default)
loadInstanceByToken(token)                           // por webhook token
loadAllInstances()                                   // para watchdog
evoBase(url) / evoFetch(instance, path, init)        // chama Evolution API com auth header
phoneFromKey(key) / phoneFromJid(jid) / phoneFromContact(it)
extractText(msg): { type, content, mime?, fileName? }
isMediaType(type): boolean
downloadAndStoreMedia(messageId, instance, item)     // baixa mídia → storage
REQUIRED_EVENTS                                      // eventos que webhook precisa subscrever
ingestMessage(item, source, opts): Promise<...>      // ⭐ função crítica
```

### `ingestMessage` — fluxo

1. Extrai `phone` de `item.key`. Sem telefone → skip.
2. Resolve `clinic_id` via `instanceId` ou via instância default.
3. Detecta `from_me`, `external_id`, conteúdo, `replyToExternalId`, `pushName` (somente quando inbound).
4. Verifica `deleted_leads`: se mensagem antiga ≤ data de exclusão, ignora.
5. Lead existente? Sim → atualiza. Não → cria, resolvendo pipeline:
   - Primeiro: pipeline `kind='sales'` ligado à `whatsapp_instance_id`.
   - Fallback: primeiro pipeline `sales` da clínica (default → menor `position` → mais antigo).
   - Sem pipeline → skip (`no-inbound-pipeline`).
6. INSERT idempotente em `messages` (unique em `lead_id, external_id`).
7. Se mídia: dispara `downloadAndStoreMedia` em background.
8. Chama `increment_unread(lead_id, preview, ts)` quando inbound.

**Pegadinhas:**
- `pushName` em mensagens `fromMe=true` é o nome do DONO da conta, não do contato. Filtrar.
- Service role bypassa RLS — `current_clinic_id()` retorna NULL. Sempre passe `clinic_id` explicitamente nos INSERTs.
- "Surdez" da instância: `evolution-health` detecta via heartbeat e dispara restart.

---

## `ai.ts`

Camada multi-provider unificada. Cada agente carrega `provider`, `api_key`, `base_url`, `model`.

```ts
type Agent = { id, provider: "openai"|"anthropic"|"google", api_key, base_url?, model, temperature, embedding_model?, embedding_api_key? }
type ChatMessage = { role, content, tool_calls?, tool_call_id?, name? }
type NormalizedResponse = { ok, status, choices:[{message:{content, tool_calls?}}], usage:{prompt_tokens, completion_tokens, total_tokens} }

chatCompletion(agent, messages, opts, ctx?): Promise<NormalizedResponse>
embed(agent, text, ctx?): Promise<number[]>          // SEMPRE 768 dims (matched com ai_chunks)
```

**Comportamento:**
- Normaliza respostas de Anthropic/Google para shape OpenAI-like.
- Auto-loga em `ai_usage` quando `ctx` é fornecido (via `metrics.logUsage`).
- Calcula `cost_usd` consultando `ai-pricing.ts`.
- Tool calls: aceita schema unificado, traduz por provider.

**Pegadinhas:**
- Forçar 768 dims é OBRIGATÓRIO — trocar exige recriar TODOS embeddings em `ai_chunks` e `agent_memory`.
- Quando `agent.api_key` é NULL, usa `LOVABLE_API_KEY` (gateway interno).
- Anthropic não tem "system" como role — convertido para parâmetro `system` separado internamente.

---

## `rag.ts`

Pipeline RAG avançado.

```ts
retrieve(agent, history, query, opts): Promise<RetrieveResult>
  - rewriteQuery(agent, history, query)              // LLM rewrites com contexto
  - HyDE: gera doc hipotético → embed → busca
  - match_chunks_hybrid (RPC)                        // RRF de vetor + FTS
  - reranker condicional (só se top-k baixa relevância)
  - match_memories (RPC)
  - Budget: RAG_CHUNK_CHAR_BUDGET = 16_000 (~4k tokens)
```

**Pegadinhas:**
- HyDE adiciona latência (~1s). Desabilitar para chats de baixa criticidade.
- Cache de embedding via `utils.getCachedEmbedding` (key = sha256(text+model)).
- Reranker pode usar provider diferente do agente (config global).

---

## `email.ts`

Mínimo, focado em util:

```ts
corsHeaders                                          // inclui svix-* headers (webhook Resend)
jsonResponse(body, init?)
renderTemplate(tpl, vars): string                    // substitui {{ var }} e {{ obj.key }}
sanitizeTagValue(input): string                      // normaliza tag Resend (slug, max 256)
isInternalContext(related_lead_table): bool          // true para leads_internal/quick_test_/campaign_test_
```

**Pegadinhas:**
- `renderTemplate` NÃO escapa HTML. Inputs DEVEM vir saneados pelo template editor.
- Tags do Resend só aceitam `[a-zA-Z0-9_-]`. Sempre passe por `sanitizeTagValue`.

---

## `spend-guard.ts`

```ts
class SpendLimitExceeded extends Error { status=402, body }
resolveClinicId({ clinic_id?, agent_id?, lead_id? }): Promise<string|null>
assertSpendAllowed(clinic_id): Promise<void>          // chama RPC check_ai_spend_status
```

**Uso obrigatório** em TODA edge de IA antes de chamar provider:

```ts
const clinic_id = await resolveClinicId({ agent_id });
await assertSpendAllowed(clinic_id);   // throws 402 se bloqueado
```

Funções que já adotaram: `ai-chat`, `ai-assist`, `ai-auto-reply`, `ai-ingest-pdf`. Falta verificar: `ai-ingest-document/url/urls`, `ai-eval-run`, `ai-analyst-run`, `classifier-daily-batch`, `daily-summary`.

---

## `metrics.ts`

```ts
type LogCtx = { agent_id?, lead_id?, thread_id?, automation_id?, note? }
logUsage(ctx, model, tokens_in, tokens_out, latency_ms, error?): Promise<void>
```

INSERT em `ai_usage`. Calcula `cost_usd` lookup em `ai-pricing.ts`. Trigger `trg_ai_usage_spend_guard` agrega imediato.

---

## `ai-pricing.ts`

Tabela hard-coded de preços (USD por 1M tokens), `input` e `output`, por modelo. **Atualizar quando provider muda preço.**

Modelos cobertos: GPT-5/5-mini/5-nano, GPT-4.1, Claude 3.5/3.7/4, Gemini 2.5 Pro/Flash/Flash-Lite, embeddings.

---

## `agent-flags.ts`

```ts
SILENT_TOOLS: Set<string>   // tools que NÃO geram resposta visível ao lead
isSilentByTools(tools): boolean
```

Lista atual: `move_lead_stage`, `add_lead_note`, `set_lead_field`, `update_custom_field`, `assign_attendant`, `remember_fact`, `transfer_to_human`, `create_task`, `schedule_message`, `get_lead_history`, `add_lead_tag`, `remove_lead_tag`, `get_lead_state`, `search_knowledge_base`, `generate_insight_report`.

**Regra**: se TODAS as tools do agente são silent → não envia mensagem, mesmo se LLM gerou texto.

---

## `mcp.ts`

Cliente HTTP para servidores MCP configurados em `agent_mcp_servers`. Faz handshake, lista tools, executa `tools/call`. Permite agentes consumirem APIs externas via padrão MCP sem código novo por integração.

---

## `attribution.ts`

```ts
type AttributionInput = { utm_source?, utm_medium?, utm_campaign?, utm_content?, referrer?, landing_page? }
resolveChannel(input, rules): { channel, source, medium }
```

Aplica `traffic_source_rules` (regex por clínica) para normalizar `(utm_source, utm_medium)` em canais legíveis (`Google Ads`, `Meta`, `Direct`, etc.). Usado em `forms-ingest`, `tracking-event`, `external-lead-capture`.

---

## `types.ts`

Tipos comuns para evitar import circular (Message, LeadLite, Intent).

---

## Pegadinhas gerais dos helpers

- **NÃO** duplique `corsHeaders` em outro arquivo. Importe.
- Ao tocar em `ingestMessage`, rode `supabase--test_edge_functions` em `evolution-webhook` se houver test.
- `ai.ts` e `rag.ts` falham silenciosamente quando provider retorna 5xx — `logUsage` grava `error`. Monitorar via `select * from ai_usage where error is not null` em `ai-spend-notify` / operations.
- `spend-guard` retorna `SpendLimitExceeded` com status 402 — frontend pode tratar para exibir UX específica (já implementado no `ai-chat`).

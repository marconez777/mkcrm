---
title: "Mapa: AI Runtime (agentes em execução)"
topic: ai
kind: map
audience: agent
updated: 2026-06-07
summary: "Tudo que executa um agente IA em produção: resposta automática a mensagem inbound, assist manual, classificador, follow-ups, copilot, e a infraestrutura compartilhada (tools, custos, spend-guard, pricing). Não inclui o **Builder** (ver mapa"
---
# Mapa: AI Runtime (agentes em execução)

> **Para localizar edições.** Para entender *por quê*, leia [`docs/edge-functions/AI.md`](../edge-functions/AI.md) e [`docs/flows/AI_AGENT_LOOP.md`](../flows/AI_AGENT_LOOP.md).
> **Última atualização:** 2026-06-03

---

## 1. O que é

Tudo que executa um agente IA em produção: resposta automática a mensagem inbound, assist manual, classificador, follow-ups, copilot, e a infraestrutura compartilhada (tools, custos, spend-guard, pricing). Não inclui o **Builder** (ver mapa próprio).

## 2. Rotas / pontos de entrada

| Origem | Entry point |
|---|---|
| Mensagem inbound WhatsApp | `evolution-webhook` → `ai-auto-reply` |
| Botão "AI assist" no Inbox | `ai-assist` (chamada pelo frontend) |
| Cron batch diário | `classifier-daily-batch` |
| Análise sob demanda | `ai-analyst-run` |
| Follow-ups agendados | `agent-followups-tick` (cron) |
| Bulk de agentes | `agent-run-bulk` |
| Métricas IA | `/metrics/ai-usage` (`src/pages/MetricsAiUsage.tsx`) |

## 3. Frontend

### Páginas
- `src/pages/MetricsAiUsage.tsx` — dashboard custos/tokens.
- `src/pages/AiInsights.tsx` — insights gerados.
- `src/pages/ai/Messages.tsx` — mensagens de IA por lead.
- `src/pages/ai/AiDashboard.tsx` — overview.
- `src/components/agents/CostsPanel.tsx` — custos por agente.
- `src/components/admin/AiSpendLimitCard.tsx` — limites por clínica (super_admin).

### Libs / helpers
- `src/lib/ai-pricing.ts` — **espelho** de `_shared/ai-pricing.ts`. Cálculo de estimativa no frontend.
- `src/lib/agent-tools.ts` — `KNOWN_AGENT_TOOLS` whitelist.

## 4. Edge functions

### Núcleo do loop
| Function | Função |
|---|---|
| `ai-chat/index.ts` | **roteador central** — carrega tools, chama provider, executa tool_calls, persiste traces. Usado por `ai-auto-reply` e `ai-assist`. |
| `ai-auto-reply/index.ts` | trigger por mensagem inbound. Carrega contexto, monta history, chama `ai-chat`, envia resposta via `evolution-send`. |
| `ai-assist/index.ts` | trigger manual do Inbox. Mesma base de `ai-auto-reply` mas sem envio automático. |

### Suporte
- `ai-analyst-run` — análise longa (PDFs etc.) com `gemini-2.5-pro`.
- `ai-eval-run` — avaliação contra dataset.
- `ai-embed` — gera embeddings.
- `ai-ingest-*` — alimenta `ai_documents` (KB).
- `ai-spend-notify` — notifica quando limite se aproxima.
- `classifier-daily-batch` — classifica leads em lote (modelo lite).
- `agent-followups-tick` — dispara follow-ups agendados.
- `agent-learn-from-thread` — extrai memórias de conversa para `agent_memory`.
- `agent-run-bulk` — roda agente sobre N leads.
- `transcribe-audio` — (TODO ainda) transcrição de áudio inbound.

### Compartilhado (`_shared/`)
| Arquivo | Função |
|---|---|
| `ai.ts` | Wrapper HTTP para todos os providers. Retorna `{ok, retryable, status, ...}`. **Toda chamada LLM passa aqui.** |
| `ai-pricing.ts` | Tabela de preços por modelo. **Espelho obrigatório** em `src/lib/ai-pricing.ts`. |
| `spend-guard.ts` | Verifica `ai_spend_limits.monthly_cap_usd`. Bloqueia retornando 402. |
| `agent-flags.ts` | Whitelist de tools. **Espelho** em `src/lib/agent-tools.ts`. |
| `rag.ts` | Busca semântica para tool `search_knowledge_base`. |
| `mcp.ts` | Integração MCP (se configurada). |
| `metrics.ts` | Helpers para gravar em `ai_usage` / `ai_chat_traces`. |
| `types.ts` | Tipos compartilhados. |

### Tools registradas (em `ai-chat/index.ts`)

Lista canônica (espelha `KNOWN_AGENT_TOOLS`):

`move_lead_stage`, `add_lead_note`, `set_lead_field`, `update_custom_field`, `add_lead_tag`, `remove_lead_tag`, `assign_attendant`, `remember_fact`, `get_lead_state`, `get_lead_history`, `create_task`, `schedule_message`, `transfer_to_human`, `search_knowledge_base`, `generate_insight_report`.

**Não existe** `create_appointment` nem `send_media` no runtime atual.

## 5. Banco de dados

### Tabelas
| Tabela | Função |
|---|---|
| `ai_usage` | 1 linha por chamada LLM (tokens, custo, modelo, latência, meta) |
| `ai_usage_daily` | rollup diário (alimenta dashboards) |
| `ai_spend_events` | eventos discretos de cobrança/limite |
| `ai_spend_limits` | `monthly_cap_usd` por clínica |
| `ai_chat_traces` | transcrição completa por turn, com `tool_calls[]` em `turns[].tool_calls` |
| `ai_agents` | configuração do agente (provider, chave, prompt, tools) |
| `agent_memory` | fatos persistidos por `remember_fact` (tabela no singular) |
| `ai_insights` | insights gerados |
| `ai_documents` | KB com embeddings |
| `scheduled_messages` | criadas pela tool `schedule_message` |
| `lead_internal_notes` | criadas pela tool `add_lead_note` |
| `lead_tasks` | criadas pela tool `create_task` |
| `message_sequence_runs` | engagement de sequences (com `stage_id_at_send`) |
| `messages.bot_agent_id` | marca mensagens out originadas por IA |
| `leads.ai_paused` | flag de pausa (manual ou via `transfer_to_human`) |

⚠️ **Não existem** tabelas `ai_runs`, `ai_tool_calls` nem `clinic_settings`. Naming canônico: `ai_usage` (1 linha por chamada) + view `ai_usage_daily` (rollup) + `ai_spend_events` (cobrança) + `ai_chat_traces` (transcrição por turno, com `tool_calls[]` em `turns[].tool_calls[]`). Memória persistente é `agent_memory` (singular). Config de IA por clínica vive em `clinics.settings.ai.*`.

### RPCs
- `engagement_sequences_summary`, `engagement_sequence_steps` — aba `/ai/engagement`.
- `admin_top_clinics` — uso de IA agregado (super_admin).
- Várias `engagement_*` para métricas.

### Triggers
- `trg_stop_sequences_on_reply` em `messages` — interrompe sequences quando lead responde.
- ⚠️ **Não existe** `tg_pause_ai_on_human_reply` — pausa é manual/via tool.

## 6. Integrações externas

- **Lovable AI Gateway** — `https://ai.gateway.lovable.dev/v1/chat/completions`. Secret: `LOVABLE_API_KEY` (auto-injetado).
- **Provider da clínica** — chave em `ai_agents.api_key`. OpenAI / Anthropic / Google / xAI / OpenAI-compatible.
- **Evolution API** — envio de resposta via `evolution-send` (ver mapa Inbox).

## 7. Invariantes — "não toque sem ler"

1. **Toda chamada LLM passa por `_shared/ai.ts`.** Não fazer `fetch` direto pro provider em outras edges.
2. **Custo registrado em `ai_usage`.** Caller é responsável por chamar o helper de `metrics.ts` ao final do turn. Modelo novo sem preço em `ai-pricing.ts` → `cost_usd=0` (silent bug).
3. **`ai-pricing.ts` ↔ `src/lib/ai-pricing.ts`** devem ser idênticos. Mudou um → mude o outro.
4. **`agent-flags.ts` ↔ `src/lib/agent-tools.ts`** devem ser idênticos.
5. **Spend guard primeiro.** `_shared/spend-guard.ts` é chamado **antes** da chamada LLM. Ordem invertida = cobrança após bloqueio.
6. **Hard cap de 6 iterações** no loop de tool_calls (`ai-chat`). Atingiu → status `loop_aborted` + fallback "humano responde já".
7. **Anti-loop bot↔bot.** `ai-auto-reply` ignora inbound cujo `bot_agent_id` aponta para outro agente da mesma clínica.
8. **Advisory lock por lead.** `pg_advisory_xact_lock(lead_id)` no início do `ai-auto-reply` para serializar mensagens simultâneas.
9. **Pause manual.** `leads.ai_paused=true` interrompe. Botão "retomar IA" no Inbox seta `false` e dispara nova resposta.
10. **`messages.bot_agent_id`** preenchido em TODA mensagem `direction='out'` originada por IA. Usado pelo anti-loop.
11. **Janela de contexto** = 30 mensagens por padrão. RAG sobre `lead_notes` complementa.
12. **Áudio inbound** não é transcrito hoje. Agente responde "ainda não escuto áudios".
13. **Markdown WhatsApp:** usar `*bold*` não `**bold**`. Já no system prompt.
14. **402 = limite estourado** ou conta Lovable sem créditos. Não retry automático.
15. **429 = rate limit.** `_shared/ai.ts` devolve `retryable:true`. Caller decide backoff.

## 8. Pegadinhas

- LLM "finge" que tool deu certo se o resultado não for explícito. Sempre conferir `ai_chat_traces.turns[].tool_calls[].status='error'` em debug.
- Mudar prompt do sistema em produção sem testar = regressão silenciosa. Usar `ai-eval-run` antes.
- 2 mensagens inbound em <1s podem disparar 2 runs — advisory lock resolve.
- Streaming ainda não usado. Todos os calls são blocking.
- Modelo descontinuado pelo gateway sem aviso longo → manter fallback configurado em `clinics.settings.ai.model_fallback`.
- Token count varia por modelo — não estimar localmente, usar `usage` da resposta.
- `LOVABLE_API_KEY` ausente em edge nova → re-deploy resolve.
- Cache de embeddings ainda não implementado — queries repetidas custam toda vez.

## 9. Receitas

### Adicionar uma nova tool ao runtime
1. **Backend (`supabase/functions/ai-chat/index.ts`):**
   - Registrar tool no array de tools (schema JSON OpenAI-compatible).
   - Implementar handler que executa a ação e retorna resultado serializável.
2. **Whitelist:**
   - Adicionar nome em `supabase/functions/_shared/agent-flags.ts`.
   - **Espelhar** em `src/lib/agent-tools.ts` (`KNOWN_AGENT_TOOLS`).
3. **Builder (opcional):** se quiser que o Builder sugira essa tool em prompts, ajustar `_shared/builder-system-prompt.ts` ou manual.
4. **DB:** se a tool persiste em tabela nova → migration com GRANT + RLS.
5. **Docs:** atualizar tabela em §4 deste mapa + lista em `docs/features/BUILDER_AGENTS.md`.

### Adicionar suporte a um modelo novo
1. `_shared/ai-pricing.ts` — adicionar entrada (input/output por 1M tokens).
2. `src/lib/ai-pricing.ts` — **espelhar**.
3. Se exigir wrapper específico (provider novo), estender `_shared/ai.ts`.
4. Validar com `ai-eval-run`.

### Ajustar limite de gastos por clínica
1. Tabela: `ai_spend_limits` (`monthly_cap_usd`).
2. UI: `src/components/admin/AiSpendLimitCard.tsx`.
3. Lógica: `_shared/spend-guard.ts`.
4. Notificação: `ai-spend-notify`.

### Adicionar novo provider LLM
1. `_shared/ai.ts` — branch novo no wrapper (auth, body shape).
2. `_shared/ai-pricing.ts` + espelho frontend.
3. UI de seleção: `src/components/agents/BuilderSetupCard.tsx` (lista de providers).
4. `ai_agents.provider` aceita string nova — sem migration necessária (campo já é livre).

### Debug "agente não responde"
1. Logs: `supabase--edge_function_logs` em `ai-auto-reply` e `ai-chat`.
2. Ver `leads.ai_paused` — pausado?
3. Ver `ai_chat_traces` última row do lead — qual foi a saída?
4. Ver `ai_usage` última row — 402? 429? status do provider?
5. Ver `messages.bot_agent_id` da inbound — anti-loop disparou?

---
title: "Mapa: Agentes IA & IA Hub"
topic: ai
kind: map
audience: agent
updated: 2026-07-01
summary: "Mapa consolidado da superfície de IA da plataforma: IA Hub (/ai/*), builder de agentes (AgentWizard + ai-builder de 1561 LOC), runtime de conversação (ai-chat multi-provider com RAG+MCP+tools), auto-reply com debounce (ai-auto-reply + scheduled-dispatcher), analista batch, ingest RAG (documento/pdf/url), memórias, insights, custos (ai_usage + spend-guard), transcrição de áudio. Cobre 13 edges ai-*, 4 edges agent-*, transcribe-audio, e as 6 libs shared. Hub navegacional da Fase 4 do F-DOC-FULL."
code_refs:
  - src/pages/ai/
  - src/pages/Agents.tsx
  - src/pages/AgentMemories.tsx
  - src/pages/AiInsights.tsx
  - src/pages/MetricsAiUsage.tsx
  - src/components/agents/
  - src/components/ai/usage/
  - src/lib/agent-tools.ts
  - src/lib/ai-pricing.ts
  - supabase/functions/ai-chat/
  - supabase/functions/ai-auto-reply/
  - supabase/functions/ai-builder/
  - supabase/functions/ai-assist/
  - supabase/functions/ai-analyst-run/
  - supabase/functions/ai-embed/
  - supabase/functions/ai-eval-run/
  - supabase/functions/ai-ingest-document/
  - supabase/functions/ai-ingest-pdf/
  - supabase/functions/ai-ingest-url/
  - supabase/functions/ai-ingest-urls/
  - supabase/functions/ai-reingest-document/
  - supabase/functions/ai-spend-notify/
  - supabase/functions/agent-create/
  - supabase/functions/agent-followups-tick/
  - supabase/functions/agent-learn-from-thread/
  - supabase/functions/agent-run-bulk/
  - supabase/functions/transcribe-audio/
  - supabase/functions/_shared/ai.ts
  - supabase/functions/_shared/rag.ts
  - supabase/functions/_shared/mcp.ts
  - supabase/functions/_shared/spend-guard.ts
  - supabase/functions/_shared/builder-system-prompt.ts
  - supabase/functions/_shared/builder-knowledge/
  - supabase/functions/_shared/agent-flags.ts
  - supabase/functions/_shared/ai-pricing.ts
  - supabase/functions/_shared/clinic-openai.ts
  - supabase/functions/_shared/lovable-ai.ts
related_docs:
  - docs/agents/TRAINING_FRAMEWORK.md
  - docs/maps/PIPELINE_RUNTIME.md
  - docs/maps/INBOX_KANBAN_LEADS.md
---

# Agentes IA & IA Hub — Mapa

Mapa consolidado da Fase 4 do F-DOC-FULL. Cruzado linha-a-linha com o código real em 2026-07-01. Total: **13 edges `ai-*` + 4 edges `agent-*` + `transcribe-audio`** (~4.043 LOC) + 6 shared libs (~1.369 LOC) + 6 páginas + 15 componentes.

## 1. Modelo mental

A plataforma tem **dois tipos de IA distintos** — não confundir com o pipeline runtime (Fase 3):

- **Agentes conversacionais** (`ai_agents.system_key IS NULL`): conversam com o lead no WhatsApp via `ai-auto-reply` → `scheduled-dispatcher` → `ai-chat`. Cada agente carrega **provider próprio (BYOK)** — `openai` / `anthropic` / `google` / `xai` / `manus` — com `api_key`, `base_url`, `model`, `temperature`, `system_prompt`. Multi-tenant por `clinic_id`.
- **Agentes de sistema** (`ai_agents.system_key = 'builder' | 'analyst' | 'summary' | 'classifier'`): agentes internos. O **Builder** é a "IA que faz IA" (assistente do AgentWizard). O **Analyst** roda batch diariamente. O classifier é do pipeline (Fase 3).

Agentes silenciosos: `ai_agents.silent = true` **OU** `tools` inclui apenas ferramentas internas (`isSilentByTools` em `_shared/agent-flags.ts`). Silenciosos rodam como "vigias" — analisam mas não enviam mensagem.

## 2. Inventário — edges `ai-*` (13)

| Edge | LOC | Papel | Provider |
|---|---:|---|---|
| `ai-chat` | 912 | Motor de conversação principal. Multi-provider via `_shared/ai.ts`. RAG avançado (rewrite + HyDE + híbrido RRF + reranker), MCP tools, tool budget, duplicate-call detection, timeouts, traces. Split de resposta via `[[SPLIT]]` para WhatsApp. Strip markdown. | BYOK do `ai_agents` |
| `ai-auto-reply` | 143 | Debouncer. Primeira inbound cria `pending_replies`; subsequentes estendem `run_at`. Também enfileira Pipeline Watcher (silent). Bot-loop guard via `messages.bot_agent_id`. | — |
| `ai-builder` | 1561 | Construtor de agentes (wizard). Actions: `ping`, `interview_plan`, `generate_system_prompt`, `suggest_kb_urls`, `draft_knowledge_base`, `audit_kb`, `generate_scenarios`, `run_evaluation`, `generate_insights`, `copilot_chat`. Injeta `LEAD_CONTEXT_CLAUSE` + `NO_MARKDOWN_CLAUSE` no prompt gerado. KB por nicho via `builder-knowledge/niches/`. | Builder shared key OU do próprio agente |
| `ai-assist` | 138 | Helper do Inbox: sugere reply e resume conversa. Usa agent da clínica (role match → `summary` → qualquer enabled). **Sem** fallback Lovable Gateway — se não há agente configurado, retorna 400. | BYOK |
| `ai-analyst-run` | 158 | Analista batch. Cron diário. Roda tools `remember_fact` + `add_lead_note` + `generate_insight_report`. Nunca envia mensagem para lead (força saída vazia). | BYOK |
| `ai-embed` | 6 | Wrapper mínimo (proxy) sobre `embed()` de `_shared/ai.ts`. 768 dims forçado (compatível com `ai_chunks`). | BYOK do agent |
| `ai-eval-run` | 36 | Executa `agent_evals` para regressão de prompt. Suportado pelo TestLab. | BYOK |
| `ai-ingest-document` | 61 | Ingesta arquivo (txt/md/pdf estruturado) em `ai_documents` + chunking + embed. | — |
| `ai-ingest-pdf` | 68 | Ingesta PDF (extração de texto + chunking + embed). | — |
| `ai-ingest-url` | 101 | Scrape de URL (metadata + main content) + chunking + embed. | — |
| `ai-ingest-urls` | 39 | Loop batch sobre `ai-ingest-url`. | — |
| `ai-reingest-document` | 62 | Reprocessa um doc existente (limpa `ai_chunks`, refaz embed). | — |
| `ai-spend-notify` | 105 | Email de alerta via Resend quando `ai_spend_limits` cruza threshold. Disparado por trigger DB via `pg_net`. | — |

## 3. Inventário — edges `agent-*` (4) + transcribe

| Edge | LOC | Papel |
|---|---:|---|
| `agent-create` | 121 | Cria `ai_agents` a partir do AgentWizard. Centraliza leitura da **Builder Shared Key** no servidor — chave nunca vai para client. Validação Zod. `key_source: "builder" \| "own"`. |
| `agent-followups-tick` | 103 | Cron 5min. Dispara follow-ups baseados em stage (`lead_ai_settings.current_stage_id` + `stage_entered_at` + `pipeline_stages.follow_up_after_min`). Idempotente via `last_followup_at`. |
| `agent-learn-from-thread` | 133 | Actions: `promote_to_eval` (anonimiza PII → `agent_evals`) e `request_patch` (envia para `ai-builder copilot_chat` pedindo patch). Regex-based anonymization: email, CPF, telefone. |
| `agent-run-bulk` | 47 | Enfileira `pending_replies` para todos leads ativos de um agente (usado pra rodar classifier em massa). |
| `transcribe-audio` | 249 | Transcrição de áudio (Whisper via provider do agent). Chamado pelo webhook do WhatsApp quando `message_type='audio'`. Grava transcrição em `messages.transcript`. |

## 4. Shared libs (`_shared/*`) — 6 arquivos, 1.369 LOC

| Arquivo | LOC | Papel |
|---|---:|---|
| `ai.ts` | 482 | Helpers multi-provider. `chatCompletion()` normaliza saída p/ OpenAI-like ({choices,usage,tool_calls}). `embed()` força 768 dims. 5 providers: openai, anthropic, google, xai, manus. Auto-log em `ai_usage` via `logUsage()`. |
| `rag.ts` | 254 | RAG avançado. Pipeline: rewrite query → HyDE doc → busca híbrida (vector + keyword com RRF) → reranker condicional → chunk budget 16k chars. Cache de embeddings. Memória do lead (`agent_memory`) via `retrieveContext`. |
| `mcp.ts` | 110 | Cliente MCP (Model Context Protocol) Streamable HTTP. `listMcpTools` + `callMcpTool` + `toOpenAITools` (namespace `<server>__<tool>`). |
| `spend-guard.ts` | 64 | `assertSpendAllowed()` bloqueia call quando `ai_spend_limits.daily_usd` estourado. Retorna 402 via `SpendLimitExceeded`. Resolve `clinic_id` a partir de `agent_id`/`lead_id`. |
| `builder-system-prompt.ts` | 117 | Templates fixos: `LEAD_CONTEXT_CLAUSE`, `NO_MARKDOWN_CLAUSE`, `SHORT_MESSAGE_CLAUSE`, `buildBuilderSystemPrompt()`. Injetados em todo prompt do builder para garantir contexto do lead + sem markdown + resposta curta. |
| `builder-knowledge/` | — | KB por nicho: `niches/*.md` + `best-practices.md`. `niche-loader.ts` monta bloco de contexto. |
| `agent-flags.ts` | 29 | `isSilentByTools()` — detecta agente silencioso via lista de tools. |
| `ai-pricing.ts` | 54 | Preços por 1M tokens de todos modelos suportados. `calcCost()` + `fmtUSD()` + `isModelKnown()`. Compartilhado com front (`src/lib/ai-pricing.ts`). |
| `classifier-ai.ts` | 159 | Fallback OpenAI para classifier (V6). `isTransientAgentError()` decide retry. |
| `clinic-openai.ts` | 57 | Resolve BYOK da clínica (`clinic_secrets`) — usado pela edge `clinic-openai-key`. |
| `lovable-ai.ts` | 43 | Wrapper do Lovable AI Gateway (Gemini/OpenAI via `LOVABLE_API_KEY`). Usado pelo classifier V6 como default. |

## 5. Frontend — IA Hub (`/ai/*`)

Todas as rotas `/ai/*`, `/agents`, `/agents/memories`, `/metrics/ai-usage` renderizam `AiHub` — que faz tab-routing interno preservando URL para bookmarks/histórico.

| Rota | Componente | Feature flag |
|---|---|---|
| `/ai` | `AiDashboard` (métricas resumidas: leads ativos, tokens, custo, tempo médio, top agents) | — |
| `/ai/agents` + `/agents` | `Agents.tsx` (lista + edição inline: prompt, temperatura, ferramentas, KB, TestLab) | `agents` |
| `/ai/agents/new` | `AgentWizard.tsx` (wizard multi-step com `ai-builder`) | `agents` |
| `/ai/memories` + `/agents/memories` | `AgentMemories.tsx` (grid de `agent_memory`, delete) | `agents` |
| `/ai/insights` | `AiInsights.tsx` (grid de `ai_insights` produzidos pelo Analyst) | `agents` |
| `/ai/usage` + `/metrics/ai-usage` | `MetricsAiUsage.tsx` (custos, `AgentRuntimeOverview`, `PipelineOverview`, `AiSpendLimitCard`) | `metrics_ai_usage` |
| `/ai/messages/*` | `Messages.tsx` (sub-tabs: Sequences, Automations, Templates, Queue) | vária |
| `/ai/broadcasts/*` | `Broadcasts` (Fase 5) | `broadcasts` |
| `/ai/reports` | `ScheduledReports` (Fase 8) | — |

## 6. Componentes de agents (15)

Todos em `src/components/agents/`:

| Componente | Papel |
|---|---|
| `AgentHealth` | Painel de saúde: última mensagem, taxa de sucesso, últimos erros |
| `AgentInsights` | Insights por agente (`ai_insights` filtrados) |
| `AlfredDialog` | Copilot conversacional pop-up (via `ai-builder copilot_chat`) |
| `AuditLogPanel` | Log de mudanças de prompt/config |
| `BuilderSetupCard` | Configura Builder Shared Key da clínica |
| `CopilotPanel` | Chat integrado com Builder para refinar agente |
| `CostsPanel` | Custos por agente (integra `ai_usage`) |
| `KbAssistant` | Assistente de curadoria de KB (draft/audit/reingest) |
| `PersonasPanel` | Configuração de personas do agente |
| `PromptDiff` | Diff visual entre versões do system_prompt |
| `PromptHistory` | Histórico de versões de `system_prompt` |
| `ProviderErrorBanner` | Banner de erro do provider (401/402/429/etc.) |
| `StagesPanel` | Configura comportamento por stage do funil (follow-up minutes, prompt override) |
| `TestLab` | Playground: cenários + `run_evaluation` via `ai-builder` |
| `ThreadLearningPanel` | UI para `agent-learn-from-thread` (promote_to_eval + request_patch) |

Componentes de usage em `src/components/ai/usage/`:
- `AgentRuntimeOverview` — custo/latência por agente conversacional.
- `PipelineOverview` — custo/latência por agente do pipeline (Fase 3).

## 7. Fluxo end-to-end (auto-reply)

```text
WhatsApp inbound ──► evolution.ts (webhook)
                      │
                      ├─► INSERT messages
                      │
                      ▼
                 ai-auto-reply
                      │  ├─► enfileira Vigia (silent) sempre
                      │  └─► se não from_me (ou silent), enfileira agente principal
                      │        UPSERT pending_replies (debounce Xs)
                      │
                      ▼
              scheduled-dispatcher (cron 10s)
                      │  claim rows onde run_at <= now
                      ▼
                  ai-chat (por agente)
                      ├─► spend-guard (402 se estourou)
                      ├─► retrieveContext (RAG + memórias)
                      ├─► listMcpTools + BUILTIN_TOOLS
                      ├─► chatCompletion (multi-provider) [loop tool calls, budget]
                      ├─► stripMarkdown + splitChunks
                      └─► evolution-send (envia partes)
                            └─► messages.bot_agent_id = agent.id  (bot-loop guard)
                      │
                      ▼
                logUsage → ai_usage
                logTrace → agent_traces
                remember_fact → agent_memory
                add_lead_note → lead_notes
```

## 8. Fluxo end-to-end (batch analyst)

```text
cron diário
  │
  ▼
ai-analyst-run
  │  para cada lead com atividade recente:
  ├─► ai-chat com ANALYSIS_PROMPT + agente do analyst
  ├─► tools invocadas: remember_fact, add_lead_note, generate_insight_report
  └─► saída de texto = "" (força não responder)
```

## 9. Fluxo do Builder (AgentWizard)

```text
UI /ai/agents/new
   │
   ├─► ai-builder action:interview_plan       → 3-5 perguntas por nicho
   ├─► ai-builder action:generate_system_prompt → prompt com LEAD_CONTEXT_CLAUSE
   ├─► ai-builder action:suggest_kb_urls      → URLs sugeridas
   ├─► ai-builder action:draft_knowledge_base → texto inicial de KB
   ├─► ai-builder action:audit_kb             → pontos fracos
   ├─► ai-builder action:generate_scenarios   → cenários p/ TestLab
   ├─► ai-builder action:run_evaluation       → roda cenários
   └─► agent-create                           → INSERT ai_agents (key_source: builder|own)
```

## 10. Tabelas do banco relevantes

- `ai_agents` — 1 linha por agente. Colunas críticas: `provider`, `api_key`, `base_url`, `model`, `temperature`, `system_prompt`, `tools`, `mcp_servers`, `embedding_model`, `embedding_api_key`, `reranker_api_key`, `system_key`, `silent`, `debounce_seconds`, `enabled`, `role`. RLS + column-level security (secrets removidos do SELECT `authenticated`).
- `ai_documents` — KB por agente. `title`, `source_url`, `content`, `agent_id`, `clinic_id`.
- `ai_chunks` — 768 dims (`vector(768)`). Índices IVFFlat + FTS (portuguese).
- `agent_memory` — fatos duráveis por lead. `kind`, `content`, `lead_id`, `agent_id`.
- `ai_insights` — outputs do analyst. `summary`, `sentiment`, `top_objections`, `top_doubts`, `top_interests`, `drop_off_reasons`, `recommendations`.
- `agent_traces` — traços por conversação (tool calls, tempo, tokens).
- `agent_evals` / `agent_eval_runs` — cenários e execuções do TestLab.
- `agent_stages` — override de comportamento por stage (`prompt_override`, `follow_up_after_min`).
- `lead_ai_settings` — settings por lead (`auto_reply`, `paused_until`, `current_stage_id`, `stage_entered_at`, `last_followup_at`).
- `pending_replies` — fila do debouncer.
- `ai_usage` — telemetria (1 linha por chamada LLM: tokens, cost, latency, provider, model).
- `ai_spend_limits` — limite USD/dia + emails de notificação.
- `agent_kb_urls` — URLs monitoradas para re-ingest.
- `clinic_secrets` — Builder Shared Key + Gemini BYOK (Fase 4 anterior).

## 11. Feature flags e config

- `clinics.settings.features.agents` — habilita módulo Agentes.
- `clinics.settings.features.metrics_ai_usage` — habilita `MetricsAiUsage`.
- `clinics.settings.ai_target_pipeline_ids` — filtro de pipelines onde o classifier atua (compartilhado com Fase 3).
- `ai_spend_limits.daily_usd` — gate 402.
- `ai_agents.silent` + `agent-flags.isSilentByTools` — decide se agente responde ou só observa.
- Builder Shared Key: armazenada em `clinic_secrets` (nome interno `builder_shared_key`), lida só server-side em `agent-create`.

## 12. Providers suportados

Todos via `_shared/ai.ts` (OpenAI-like response shape):

| Provider | Chat | Embed | Notas |
|---|---|---|---|
| `openai` | ✅ (gpt-4o, gpt-4o-mini, gpt-5-*) | ✅ (text-embedding-3-small, 768 dims) | Suporta `base_url` para BYOK compatíveis |
| `anthropic` | ✅ (claude-3.5-*, claude-4-*) | ❌ | Tool calling normalizado para OpenAI-like |
| `google` | ✅ (gemini-1.5/2.0/2.5-*) | ✅ (gemini-embedding-001, 768 dims) | Usado pelo classifier V6 default |
| `xai` | ✅ (grok-*) | ❌ | Provider "openai-compatível" |
| `manus` | ✅ | ❌ | Provider brasileiro (BYOK) |
| Lovable Gateway | via `_shared/lovable-ai.ts` | — | Usado pelo classifier — não pelos agentes conversacionais |

Regra: **agentes conversacionais são 100% BYOK**. Não há fallback para Lovable Gateway — se o agente não tem `api_key`, `ai-assist` retorna 400 e `ai-chat` falha explícito. Justificativa: cada clínica paga sua própria API para escapar de rate limits compartilhados.

## 13. Custos, spend guard e alertas

- `_shared/spend-guard.assertSpendAllowed()` é o gate: chamado no início de `ai-chat`, `ai-auto-reply`, `ai-assist`. Erro `SpendLimitExceeded` retorna HTTP 402 + body `{ error: "daily_spend_limit_reached", spent_usd, limit_usd }`.
- Trigger DB em `ai_usage` dispara `ai-spend-notify` via `pg_net` quando cruza thresholds (50%, 80%, 100%).
- UI: `MetricsAiUsage` + `CostsPanel` + `AiSpendLimitCard`.
- Custo unitário: `_shared/ai-pricing.ts` (compartilhado com front via `src/lib/ai-pricing.ts`).

## 14. Segurança — column-level security

Aplicado em migration prévia (Fase de security scan):
- `ai_agents.api_key`, `embedding_api_key`, `reranker_api_key` — removidos do SELECT `authenticated`. Só service_role lê.
- `clinic_secrets` — só service_role. Builder Shared Key nunca sai do servidor.
- `agent_memory` / `agent_traces` — RLS scope por `clinic_id`.

## 15. Invariantes (não quebrar)

1. **BYOK obrigatório para agentes conversacionais** — nunca adicionar fallback silencioso para Lovable Gateway em `ai-chat`/`ai-assist`/`ai-auto-reply`.
2. **Bot-loop guard** — `messages.bot_agent_id` **sempre** preenchido pelo `evolution-send` quando `from_me=true` disparado por agente; `ai-auto-reply` skipa se essa combinação bate. Remover isso = loop infinito.
3. **`isSilentByTools` é fonte de verdade** para vigias — não hardcodear listas de agentes silenciosos.
4. **Embeddings sempre 768 dims** — `ai_chunks.embedding` é `vector(768)`. Mudar dim quebra RAG inteiro.
5. **Builder Shared Key server-side** — `agent-create` lê a chave; nunca expor via API pública ou VITE_.
6. **`spend-guard` antes de qualquer LLM call** — omitir = risco financeiro para a clínica.
7. **`[[SPLIT]]` + `stripMarkdown`** só em `ai-chat` output para WhatsApp — não aplicar em `ai-assist` (Inbox renderiza markdown).
8. **`system_key='builder'`** é único por clínica — mais de um builder por clinic quebra `loadBuilder()`.
9. **Analyst nunca responde** — `ANALYSIS_PROMPT` força saída vazia; adicionar tool `send_message` quebra o contrato.
10. **`agent-learn-from-thread` anonimiza PII antes de ir para eval** — regex de email/CPF/telefone é obrigatório.
11. **Debounce mínimo 1s** — `Math.max(debounce, 1)` no `ai-auto-reply` evita disparo síncrono.

## 16. Dívidas técnicas

- `ai-chat` (912 LOC) e `ai-builder` (1561 LOC) são candidatos claros a split por action/responsabilidade.
- Falta template genérico "how to write an agent" além do `TRAINING_FRAMEWORK.md`.
- Não há doc de `mcp.ts` — configuração de MCP servers é feita direto em `ai_agents.mcp_servers` (JSONB) sem UI dedicada.
- `transcribe-audio` (249 LOC) merece doc própria (provider selection, storage do áudio, custo).
- `ai-eval-run` (36 LOC) é stub — a lógica real de eval vive em `ai-builder action:run_evaluation`. Consolidar.
- `pending_replies` sem cleanup automático de linhas antigas (`status='sent'` acumula).
- Não há circuit-breaker por agente — se um provider cai, todas as clínicas com aquele provider ficam pendendo (só o spend-guard e o classifier V6 têm blocked_until).
- `agent-followups-tick` (5min) ignora fuso-horário da clínica — pode disparar às 3h da manhã em ES-ES/EN-US.

## 17. Docs relacionadas existentes

- `docs/agents/TRAINING_FRAMEWORK.md` — framework para treinar agentes.

Não há docs para: `ai-chat` runtime, `ai-builder` API completa, MCP setup, RAG pipeline, `ai_spend_limits`, TestLab, StagesPanel, `agent-learn-from-thread`. **Registrado em INVENTORY como dívida da Fase 4**.

---
title: "Fluxo: AI Agent Loop (auto-reply e assist)"
topic: ai
kind: flow
audience: agent
updated: 2026-06-09
summary: "Loop de resposta automática (ai-auto-reply) e assistência manual (ai-assist) — carrega contexto, chama o provedor LLM da clínica via `_shared/ai.ts`, executa tools, persiste em `ai_usage` + `ai_chat_traces` e dispara `evolution-send`."
---
# Fluxo: AI Agent Loop (auto-reply e assist)

> **Quando ler:** antes de adicionar uma tool nova, mudar prompt, mexer no custo/limite, ou debugar resposta estranha do agente.
> **Última atualização:** 2026-06-09
>
> ⚠️ **Naming**: as tabelas reais de telemetria/custo são `ai_usage` (1 linha por chamada), a view `ai_usage_daily` (rollup), `ai_spend_events` (eventos de cobrança) e `ai_chat_traces` (transcrições por turno, com `turns[].tool_calls[]`). As configurações de IA por clínica vivem em `clinics.settings.ai.*` — **não existe** tabela `clinic_settings`, `ai_runs` ou `ai_tool_calls`. Memória persistente do agente fica em `agent_memory` (singular).

---

## Atores

- **Edge function** `ai-auto-reply` (gatilho por mensagem inbound) ou `ai-assist` (gatilho manual do usuário no Inbox); ambas roteiam para `ai-chat` que carrega tools e provedor
- **Provedor LLM da clínica** (OpenAI / Anthropic / Google / xAI / OpenAI-compatible) — chave gerenciada por `ai_agents.api_key` (criptografada). Não há mais dependência obrigatória do Lovable AI Gateway no loop principal
- **Postgres**: `ai_usage`, `ai_chat_traces`, `ai_threads`, `ai_messages`, `ai_insights`, `agent_memory`, `lead_internal_notes`, `scheduled_messages`, `lead_tasks`, `messages`
- **Edge function** `evolution-send` (efetua a resposta no WhatsApp)

---

## Loop

```text
trigger (inbound msg | usuário pede assist)
        │
        ▼
ai-auto-reply  →  ai-chat
   │ 1) carrega contexto: lead, últimas N msgs, clinics.settings.ai.*,
   │    knowledge base embeddings (ai-embed/_shared/rag.ts) se RAG ativo
   │ 2) monta system prompt + history
   │ 3) abre transcrição em ai_chat_traces (turns[])
   │
   ├─────────► [LLM call — provedor da clínica via _shared/ai.ts]
   │              │
   │              ▼
   │           response: text OU tool_calls[]
   │
   │ se tool_calls:
   │    para cada tool:
   │       executa (ver tabela abaixo)
   │       append em ai_chat_traces.turns[].tool_calls[] (name, args, result, status)
   │    volta pro LLM com tool_results
   │    (max 6 iterações — guard rail)
   │
   │ se text final:
   │    INSERT ai_usage (model, tokens_in, tokens_out, cost_usd, note)
   │    (opcional) INSERT ai_spend_events
   │    chama evolution-send(text)
   │    persiste turn em ai_messages
   │
   ▼
fim
```

---

## Tools disponíveis

Registradas em `supabase/functions/ai-chat/index.ts` e whitelisted no frontend por `src/lib/agent-tools.ts` (`KNOWN_AGENT_TOOLS`):

| Tool | Efeito |
|---|---|
| `move_lead_stage` | Move o lead para outro estágio do pipeline (por nome). |
| `add_lead_note` | Anota observação interna em `lead_internal_notes`. |
| `set_lead_field` | Atualiza um campo nativo do lead (`name`, `email`, `phone`, etc.). |
| `update_custom_field` | Atualiza chave em `leads.custom_fields`. |
| `add_lead_tag` / `remove_lead_tag` | Manipula `leads.tags`. |
| `assign_attendant` | Atribui atendente (por nome). |
| `remember_fact` | Persiste fato em `agent_memory` para uso futuro do agente. |
| `get_lead_state` / `get_lead_history` | Lê estado e mensagens recentes do lead. |
| `create_task` | Cria tarefa vinculada ao lead. |
| `schedule_message` | Agenda mensagem futura em `scheduled_messages`. |
| `transfer_to_human` | Pausa o agente nesse lead (`leads.ai_paused=true`) e marca handoff. |
| `search_knowledge_base` | Busca semântica em `ai_documents` (RAG — ver `_shared/rag.ts`). |
| `generate_insight_report` | Gera resumo/insight do lead, persistido em `ai_insights`. |

> Não há tool `create_appointment` nem `send_media` no runtime atual — agendamento é feito por automation `before_appointment` (ver `features/APPOINTMENT_REMINDERS.md`); mídia é responsabilidade do atendente humano.

---

## Pause / handoff

- Humano respondendo manualmente no Inbox → o frontend/`ai-auto-reply` checa `messages.bot_agent_id IS NULL` (resposta humana) e o frontend marca `leads.ai_paused=true` quando o atendente assume. **Não existe** tool `pause_ai_for_lead` nem trigger `tg_pause_ai_on_human_reply` — pausa é via UI ou via tool `transfer_to_human`. Em paralelo, `trg_stop_sequences_on_reply` em `messages` interrompe sequences ativas.
- Tool `transfer_to_human` faz o mesmo (seta `ai_paused=true` e marca handoff).
- Retomada: botão "retomar IA" no Inbox seta `ai_paused=false` e dispara `ai-auto-reply` com a última msg do lead.

---

## Custos e limites

- **Spend guard** (`_shared/spend-guard.ts`): `ai_spend_limits.monthly_cap_usd` é o limite mensal por clínica (não vive em `clinics.settings.ai.monthly_budget_usd`). Estouro → `ai-chat`/`ai-auto-reply` retornam HTTP **402** (`limit_exceeded`).
- Cada linha de `ai_usage` registra `cost_usd` calculado em `_shared/ai-pricing.ts` (espelhado em `src/lib/ai-pricing.ts`) — preços por 1M tokens, por modelo/provedor.
- Visão por clínica: view `ai_usage_daily` (rollup diário) + RPCs `engagement_*`/`admin_top_clinics`. Ver `operations/COSTS_LIMITS.md` para retenção e tabela atualizada.

---

## Pegadinhas

- **Loop infinito de tool calls**: hard cap em 6 iterações. Se atingir, encerra com fallback ("um humano te responde já") e o turno fica marcado em `ai_chat_traces` para auditoria.
- **Loop bot-↔-bot (cross-agente)**: `messages.bot_agent_id` é gravado em toda mensagem `direction='out'` originada por agente IA. `ai-auto-reply` ignora `inbound` cujo `bot_agent_id` aponta para outro agente da mesma clínica → evita dois agentes conversando entre si via números de teste.
- **Engajamento de sequências**: `message_sequence_runs.replied_at` (e snapshot `stage_id_at_send` / `stage_position_at_send`) são preenchidos quando o lead responde após o envio. Alimentam as RPCs `engagement_sequences_summary`/`engagement_sequence_steps` (aba `/ai/engagement`).
- **Tool falha silenciosamente**: sempre verificar `ai_chat_traces.turns[].tool_calls[].status='error'` em debug. O LLM costuma "fingir" que deu certo se o resultado da tool não for explícito.
- **Janela de contexto**: cortamos histórico em 30 mensagens por padrão. Conversas muito longas perdem contexto inicial — RAG sobre `lead_notes` mitiga.
- **Concorrência**: 2 mensagens inbound em <1s podem disparar 2 runs paralelos. Usamos `pg_advisory_xact_lock(lead_id)` no início do `ai-auto-reply` para serializar.
- **Áudio inbound**: hoje não é transcrito. Agente responde "ainda não escuto áudios". TODO: integrar Whisper.
- **Markdown na resposta**: WhatsApp não renderiza `**bold**` igual; usar `*bold*`. Prompt do sistema já instrui isso.

---

## Melhorias sugeridas

- Streaming de resposta (hoje é blocking).
- Cache de embeddings por query similar.
- A/B test de prompts via `ai_eval_run`.
- Transcrição de áudio inbound.

---

## Arquivos-chave

- `supabase/functions/ai-auto-reply/index.ts`
- `supabase/functions/ai-assist/index.ts`
- `supabase/functions/_shared/ai-tools.ts`
- `supabase/functions/_shared/ai-pricing.ts`
- `src/lib/ai-pricing.ts` (espelho no frontend)
- `edge-functions/AI.md`

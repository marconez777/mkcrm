# Fluxo: AI Agent Loop (auto-reply e assist)

> **Quando ler:** antes de adicionar uma tool nova, mudar prompt, mexer no custo/limite, ou debugar resposta estranha do agente.
> **Última atualização:** 2026-05-25

---

## Atores

- **Edge function** `ai-auto-reply` (gatilho por mensagem inbound) ou `ai-assist` (gatilho manual do usuário no Inbox)
- **Lovable AI Gateway** (Gemini/GPT)
- **Postgres**: `ai_runs`, `ai_messages`, `ai_tool_calls`, `lead_notes`, `appointments`, `wa_messages`
- **Edge function** `evolution-send` (efetua a resposta)

---

## Loop

```text
trigger (inbound msg | usuário pede assist)
        │
        ▼
ai-auto-reply
   │ 1) carrega contexto: lead, últimas N msgs, clinic_settings.ai_*,
   │    knowledge base embeddings (ai-embed) se RAG ativo
   │ 2) monta system prompt + history
   │ 3) INSERT ai_runs(status='running', model, lead_id)
   │
   ├─────────► [LLM call via ai_gateway]
   │              │
   │              ▼
   │           response: text OU tool_calls[]
   │
   │ se tool_calls:
   │    para cada tool:
   │       INSERT ai_tool_calls(name, args, status='running')
   │       executa (ver tabela abaixo)
   │       UPDATE ai_tool_calls SET result, status='ok'|'error'
   │    volta pro LLM com tool_results
   │    (max N iterações — guard rail)
   │
   │ se text final:
   │    UPDATE ai_runs(status='ok', tokens_in, tokens_out, cost_usd)
   │    chama evolution-send(text)
   │    INSERT ai_messages (persiste turn)
   │
   ▼
fim
```

---

## Tools disponíveis

| Tool | Efeito |
|---|---|
| `create_appointment` | INSERT em `appointments` (valida conflito de horário) |
| `update_lead_stage` | Move o lead no Kanban |
| `add_lead_note` | Anota observação interna |
| `set_lead_tag` | Adiciona tag |
| `search_knowledge_base` | Busca semântica em `ai_documents` (embeddings) |
| `transfer_to_human` | Pausa o agente nesse lead (`leads.ai_paused=true`) |
| `send_media` | Envia imagem/PDF da KB |

Definições: `supabase/functions/_shared/ai-tools.ts`.

---

## Pause / handoff

- Qualquer humano respondendo manualmente no Inbox → trigger `tg_pause_ai_on_human_reply` seta `leads.ai_paused=true`.
- Tool `transfer_to_human` faz o mesmo.
- Retomada: botão "retomar IA" no Inbox seta `ai_paused=false` e dispara `ai-auto-reply` com a última msg do lead.

---

## Custos e limites

- `clinic_settings.ai_monthly_budget_usd`: hard limit. Quando ultrapassado, `ai-spend-notify` envia email + pausa novos runs (retorna `budget_exceeded`).
- Cada `ai_runs` registra `cost_usd` calculado em `ai-pricing.ts` (preços por 1M tokens, por modelo).
- Ver `operations/COSTS_LIMITS.md` para tabela atualizada.

---

## Pegadinhas

- **Loop infinito de tool calls**: hard cap em 6 iterações. Se atingir, `ai_runs.status='loop_aborted'` e manda fallback ("um humano te responde já").
- **Loop bot-↔-bot (cross-agente)**: `messages.bot_agent_id` é gravado em toda mensagem `direction='out'` originada por agente IA. `ai-auto-reply` ignora `inbound` cujo `bot_agent_id` aponta para outro agente da mesma clínica → evita dois agentes conversando entre si via números de teste.
- **Engajamento de sequências**: `message_sequence_runs.replied_at` (e snapshot `stage_id_at_send` / `stage_position_at_send`) são preenchidos quando o lead responde após o envio. Alimentam as RPCs `engagement_sequences_summary`/`engagement_sequence_steps` (aba `/ai/engagement`).
- **Tool falha silenciosamente**: sempre verificar `ai_tool_calls.status='error'` em debug. O LLM costuma "fingir" que deu certo se o resultado da tool não for explícito.
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

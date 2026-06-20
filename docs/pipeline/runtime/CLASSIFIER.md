---
title: "Classifier LLM (pipeline-classify) — runtime V6"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-20
summary: "Edge function pipeline-classify V6: Arquitetura paralela de 5 Agentes (Resumidor, Agendador, Tipificador, Movimentador, Maestro), parser de datas determinístico, General Move com fallback, lock em Paciente antigo, G10 implementado via trigger PG + RPC apply_lead_automation_patch."
code_refs:
  - supabase/functions/pipeline-classify/index.ts
  - supabase/functions/pipeline-classify/schema.ts
  - supabase/functions/pipeline-classify/context.ts
  - supabase/functions/pipeline-classify/agent-core.ts
  - supabase/functions/pipeline-classify/date-parser.ts
  - supabase/functions/pipeline-classify/apply.ts
  - supabase/functions/pipeline-classify/rules/first-consult.ts
  - supabase/functions/pipeline-classify/rules/intent-effects.ts
  - supabase/functions/_shared/dates.ts
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/_shared/pipeline-fase4.ts
  - supabase/functions/_shared/pipeline-tasks.ts
  - supabase/functions/_shared/pipeline-summarize-core.ts
related_docs:
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/EVENTS_TELEMETRY.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
  - docs/pipeline/runtime/DATABASE_LIVE.md
---

# Classifier `pipeline-classify` — V6 (5 Agentes)

> Reconstrução multi-step (junho/2026). Substitui o modelo sequencial V5 por uma **Linha de Montagem Paralela de 5 Agentes**:
> 1. **Resumidor (gpt-4o)**: Extrai passado/presente e datas puras, blindado à Autoridade da Secretária.
> 2. **Agendador (gpt-5-mini)**: Roda em PARALELO, foca exclusivamente na intenção de agenda (novo, reagendamento, cancelamento).
> 3. **Tipificador / Preenchedor (gpt-5-mini)**: Roda em PARALELO, sugere tags (whitelist) e preenche chips. Obedece rigorosamente à Autoridade da Secretária para campos de pagamento.
> 4. **Movimentador (gpt-5-mini)**: Roda em PARALELO, foca apenas na recomendação de estágio (`stage_suggestion`) baseada na inatividade temporal e intent.
> 5. **Maestro (gpt-5)**: Juiz final. Recebe os 3 outputs dos especialistas, valida contradições cruzadas e formata a resposta canônica.
> 
> O classificador possui **General Move** (auto-move) ativado para cenários de alta confiança, 
> realiza override de G10 para datas extraídas do chat, suporta uma whitelist de tags expandida.

## Resumo

| | |
|---|---|
| Entry | `supabase/functions/pipeline-classify/index.ts` |
| Modelos | `gpt-4o` (Resumidor) + 3x `gpt-5-mini` (Especialistas) + `gpt-5` (Maestro) |
| Cron | `pipeline-classify-tick` — `* * * * *` |
| Toggle global | `automation.classifier.enabled` |
| Batch | 50 leads/tick |
| Watermark | `leads.last_processed_message_id_classifier` |
| Telemetria | `lead_events.type='auto:classifier'` com `payload.agents` refletindo os 5 modelos e latências. |

## Arquivos

```text
pipeline-classify/
├── index.ts             dispatcher + cron tick
├── schema.ts            Zod schemas p/ 5 Agentes independentes + canon names, intents, tags protegidas
├── context.ts           loadLeadContext: lê lead + ai_summary + watermark; early-return
├── agent-core.ts        Orquestra a pipeline Promise.all dos Agentes (generateText)
├── date-parser.ts       wrapper sobre parseFutureDateInTZ (ZERO LLM)
├── apply.ts             ordem de aplicação: first-consult → datas (G10) → fields (G10) → tags (whitelist) → B2B/General Move → intent-effects → telemetria → watermark
├── rules/first-consult.ts   regra "1ª consulta" com fallback no ai_summary
├── rules/intent-effects.ts  wrapper sobre runNfTask / runPaymentAlleged / runJudicializacao / runRenovacaoReceita / runObjectionSuggest
├── date-parser_test.ts      4 testes Deno
└── first-consult_test.ts    5 testes Deno
```

## Schemas dos Agentes (`schema.ts`)

A saída é dividida em 5 esquemas blindados:

**Agente 1 (Resumidor)**
Extrai fatos. Obriga a registrar o que a Secretária confirmou versus o que o Paciente alegou.
```ts
z.object({
  summary: z.string(),
  mentioned_dates: z.array(z.object({
    raw: z.string().max(120),
    anchor_iso: z.string(),
    kind: z.string()
  })).max(4)
})
```

**Agente 2 (Agendador)**
Especialista temporal e de intenções de marcação.
```ts
z.object({
  is_scheduling_action: z.boolean(),
  scheduling_intent: z.enum(["novo_agendamento", "reagendamento", "cancelamento", "duvida_agenda", "nenhum"]),
  reasons: z.array(z.string()).max(3)
})
```

**Agente 3 (Tipificador / Preenchedor)**
Responsável pelo data entry dos chips.
```ts
z.object({
  tags_suggested: z.array(z.string().max(40)).max(8),
  custom_fields_patch: z.record(z.string(), z.union([z.string(),z.number(),z.boolean(),z.null()]))
})
```

**Agente 4 (Movimentador)**
Responsável exclusivo pelo Funil Kanban.
```ts
z.object({
  stage_suggestion: z.string(),
  intent: z.string().default("outro"),
  mentioned_intents: z.array(z.string()).max(3),
  is_b2b: z.boolean(),
  reasons: z.array(z.string()).max(3)
})
```

**Agente 5 (Maestro)**
Responsável pela validação cruzada dos schemas 2, 3 e 4.
```ts
z.object({
  stage_suggestion: z.string(),
  intent: z.string().default("outro"),
  confidence: z.number().min(0).max(1),
  is_b2b: z.boolean(),
  reasons: z.array(z.string()).min(1).max(5),
  mentioned_intents: z.array(z.string()).max(3)
})
```

> **Enums relaxados**: `gpt-5-mini` rejeitava o schema quando enums
> eram declarados diretamente. Declaramos como `z.string()` e normalizamos em `mergeV6Outputs()` —
> stages/intents inválidos caem para defaults (`"Qualificação"` / `"outro"`).

## Datas — extração + parser determinístico

O LLM **NUNCA converte data**. Devolve apenas a string crua + o timestamp ISO da
mensagem que cita (`anchor_iso`). O `date-parser.ts` chama
`parseFutureDateInTZ(raw, "America/Sao_Paulo", anchor)` e gera o ISO UTC determinístico, que vira `consulta_agendada_em` ou `procedimento_agendado_em`.

## Gate G10 — implementado via DB

1. **Trigger PG `track_custom_fields_human_edits`** dispara BEFORE UPDATE OF
   `custom_fields`. Para cada chave alterada, grava `{key: now_iso}` no jsonb,
   **exceto** quando `current_setting('app.actor') = 'system'`.
2. **RPC `apply_lead_automation_patch(p_lead_id, p_custom_fields, p_tags)`** aplica como 'system'.
3. **`apply.ts`** lê `lead.custom_fields_last_human_edit[key]`; se o timestamp
   for mais novo que `now − 7d`, descarta a sugestão da IA para essa chave e
   registra em `applied.custom_fields.blocked_by_g10`.
   - **Exceção (Override de Data)**: Se o parser identificar uma data e a confiança 
     da IA for `>= 0.85`, o sistema ignora o G10 (`isDateFromParser = true`), sobrepondo a 
     edição humana.

## Autoridade da Secretária (A Regra de Ouro)

O modelo V6 é estrito: A palavra da secretária tem prioridade absoluta sobre o paciente.
Se o paciente diz "já paguei" e não há envio de comprovante/confirmação pela atendente, o sistema atribui a TAG `pagamento_alegado` ao invés de setar o status `pago`. A IA só preencherá status pagos/agendados quando houver validação da clínica no chat (e.g. templates ou confirmações verbais).

## Movimentações e Auto-Move (General Move / B2B / Lock D3)

0. **Lock D3 (Paciente antigo)**: se o lead já está em "Paciente antigo", o Classifier nem tenta. `would_move = false`. B2B/Nurture/General pulados.
1. **General Move**: IA sugere move se `confidence >= 0.8` e se não houve move humano nas últimas 24h.
2. **B2B Path**: exige `is_b2b === true`, `confidence >= 0.95`, tag `b2b`, e ausência de histórico de tratamento.

## Dispatcher (`index.ts`)

O cron `pipeline-classify-tick` continua chamando `action:'tick'` a cada minuto. O dispatcher lê a fila e invoca `agent-core.ts` que agora executa o Resumidor, depois despacha 3 chamadas HTTP paralelas no SDK da OpenAI e por fim aciona o Maestro.

## Smoke test (V6)

```bash
# Tick forçado:
curl -X POST <function_url>/pipeline-classify \
  -d '{"action":"tick"}'

# Lead específico:
curl -X POST <function_url>/pipeline-classify \
  -d '{"action":"lead","lead_id":"<uuid>"}'
```

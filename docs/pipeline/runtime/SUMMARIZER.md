---
title: "Summarizer — runtime"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-20
summary: "runSummarize() em _shared/pipeline-summarize-core.ts. Acoplado ao classifier V6 (sempre rodado ao final, force em intents não triviais — independe do Agente Resumidor interno do classifier). Mantém leads.ai_summary ≤800 chars."
code_refs:
  - supabase/functions/_shared/pipeline-summarize-core.ts
  - supabase/functions/pipeline-summarize/index.ts
related_docs:
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/DATABASE_LIVE.md
---

# Summarizer

| | |
|---|---|
| Arquivo principal | `supabase/functions/_shared/pipeline-summarize-core.ts` (127 linhas) |
| Entry standalone | `supabase/functions/pipeline-summarize/index.ts` (46 linhas) — usado em smoke test |
| Modelo | `gpt-5-mini` |
| Toggle | `automation.summarizer.enabled` (true) |
| Max chars output | 800 |
| Max msgs lidos | 60 |
| Max chars input (P4) | 40.000 (mensagens mais antigas são droppadas; prefixo `…+N mensagens anteriores omitidas`) |
| MIN_NEW_MSGS | 3 (ignorado quando `force=true`) |

## Quando roda

1. **Sempre** ao final de `pipeline-classify::classifyOne`, com `force = (intent !== 'outro')`. Ou seja: intents triviais respeitam o threshold de 3 novas mensagens; intents notáveis forçam regen.
   > Nota: este `runSummarize` é **distinto** do *Agente 1 — Resumidor* interno da linha de montagem V6 do classifier (`agent-core.ts::runSummarizer`). O Resumidor V6 alimenta os 3 paralelos + Maestro **dentro** da execução; o `runSummarize` aqui atualiza `leads.ai_summary` para uso fora do classifier (inbox, drawer, agente WhatsApp).
2. Standalone via HTTP POST `{lead_id, force?, reason?}` na função `pipeline-summarize`.
3. Não há cron próprio.

## Decisão "should run"

```
if !toggle               → skip toggle_off
if !allowlisted          → skip clinic_not_allowlisted
if no messages           → no_messages
if watermark == lastMsg  → noop (no_new_messages)
if !force && newCount<3  → skip only_<N>_new_msgs
else                     → roda
```

`newCount` = mensagens depois do `last_processed_message_id_summarizer`.

## Prompt

```text
[system]
Você produz resumos enxutos de leads de uma clínica médica para uso interno da equipe.
Escreva PT-BR, ≤800 caracteres, em parágrafo único, factual, sem opinião.
Mencione: nome se citado, queixa/interesse principal, momento atual do funil,
próximos passos pendentes, e qualquer info financeira/agendamento relevante.

[user]
Resumo anterior do lead:
<lead.ai_summary || "(sem resumo prévio)">

Histórico recente (<N> msgs):
[YYYY-MM-DD HH:mm] ATENDENTE|LEAD: <até 500 chars>
...

Atualize o resumo refletindo o estado mais recente. Não exceda 800 caracteres.
```

Output é puro texto (`generateText` sem schema). Trim + slice(800).

## O que escreve

```sql
UPDATE leads SET
  ai_summary = '<≤800 chars>',
  last_processed_message_id_summarizer = '<lastMsgId>'
WHERE id = leadId;

INSERT INTO lead_events (type, payload) VALUES (
  'auto:summarize',
  {reason, new_messages, chars}
);
```

## Resultado

```ts
{ status: 'ok'|'skipped'|'no_messages'|'noop', reason?, summary?, last_message_id? }
```

## Limitações

- Não há limite explícito de custo por execução além do toggle global de spend (`ai_spend_limits`).
- O resumo é totalmente sobrescrito a cada chamada; não há acumulação cronológica.
- Mensagens são truncadas a 500 chars, então áudios transcritos longos podem perder contexto.
- Sem retry — se a chamada falhar, o classifier captura e devolve `{status:'error', reason}` mas não reagenda.

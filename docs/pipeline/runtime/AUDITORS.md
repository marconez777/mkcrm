---
title: "Auditores A1 e A2 — runtime"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "A1 pipeline-position-auditor (cron diário, revisa leads parados ≥7d) e A2 pipeline-post-move-verifier (hook async pós-move auto:*). Ambos só sinalizam via tag/task/event — nunca movem card."
code_refs:
  - supabase/functions/pipeline-position-auditor/index.ts
  - supabase/functions/pipeline-post-move-verifier/index.ts
  - supabase/functions/_shared/pipeline-move.ts
related_docs:
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/ARCHITECTURE.md
  - docs/pipeline/runtime/GATES.md
---

# Agentes auditores (Marco 2.5)

Princípio comum (gate G11 estendido): **nenhum auditor move card, edita `appointments`, ou altera `pipeline_id`.** Só sinalizam via:

- `lead_events` (sempre)
- `leads.tags` (em discordância)
- `lead_tasks` (A1 apenas)

## A1 — `pipeline-position-auditor`

| | |
|---|---|
| Arquivo | `supabase/functions/pipeline-position-auditor/index.ts` (329 linhas) |
| Modelo | `gpt-5-mini` |
| Cron | `pipeline-position-auditor-daily` — `0 6 * * *` UTC = **03:00 BRT** |
| Toggle | `automation.position_auditor.enabled` = true |
| Batch | `automation.position_auditor.batch_size` (default 50, max 500) |
| Histórico | últimas 30 mensagens |

### Seleção de candidatos

1. `leads.stage_changed_at < now() - 7d`
2. `stage_id NOT NULL`, `pipeline_id NOT NULL`
3. Stage **não** ∈ `{Paciente antigo, Nutrição inativa, B2B / Stakeholders, B2B, Desqualificado, Lead não qualificado}` (set hardcoded).
4. `custom_fields.qualificacao ≠ 'desqualificado'`.
5. Não auditado nos últimos 14 dias (`lead_events.type IN ('position_audit_ok','position_audit_disagreement')`).
6. Sem `appointments.scheduled_at > now()` (lead com consulta futura é pulado).
7. Pega até `batch_size` candidatos por execução (sobre-amostra 5x antes do filtro).

### Prompt (literal, linhas 119–133)

```text
Você é um auditor de posição de pipeline de CRM médico (revisor de segunda opinião).
Receberá o histórico de um lead que está PARADO há mais de 7 dias na coluna "<stage>".
Sua tarefa: dizer se essa posição AINDA é correta, ou se já deveria estar em outra coluna.

Pipeline canônico v4.2 (use exatamente estes nomes em stage_suggestion):
- Novo
- Qualificação
- Consulta agendada
- Tratamento agendado
- Consulta finalizada
- Em tratamento
- Sem resposta
- Nutrição inativa
- Paciente antigo
- B2B / Stakeholders

Regras:
- agrees_with_current=true se "<stage>" continua sendo o stage adequado.
- agrees_with_current=false só se o histórico evidencia transição clara (ex: consulta marcada,
  lead desistiu, virou paciente antigo).
- confidence reflete sua certeza. Use ≤ 0.6 quando o histórico for ambíguo.
- reasoning: 1 parágrafo curto em PT-BR justificando.
- NUNCA sugira mover por mera intuição — exige evidência textual.
```

### Schema de saída

```ts
{ stage_suggestion: enum(CANON), confidence: 0..1, agrees_with_current: bool, reasoning: ≤400 chars }
```

### Critério de discordância

```
disagree = !agrees_with_current
        && stage_suggestion !== currentStage
        && confidence >= 0.75
```

### Ações quando discorda

1. `leads.tags += ['precisa_atencao_humana', 'auditor_sugere_<canon_slug>']` (merge). O slug é lowercase, espaços → `_`, remove não-alfanuméricos. Ex: `B2B / Stakeholders` → `auditor_sugere_b2b__stakeholders`.
2. INSERT `lead_tasks` `{title: 'Revisar posição: auditor sugere mover para "<X>" (conf 0.XX)', due_at: now()+2d}`.
3. INSERT `lead_events.type='position_audit_disagreement'` com payload `{from_stage, to_stage, confidence, reasoning}`.

### Ações quando concorda (ou conf baixa)

INSERT `lead_events.type='position_audit_ok'` com `{stage, confidence, agrees_with_current}`. Silencioso para o usuário; só serve para idempotência do próximo ciclo.

### Smoke test

`POST {action:'lead', lead_id:<uuid>}` audita um único lead independente do critério temporal.

## A2 — `pipeline-post-move-verifier`

| | |
|---|---|
| Arquivo | `supabase/functions/pipeline-post-move-verifier/index.ts` (193 linhas) |
| Modelo | `gpt-5-nano` (mais barato — só responde verdict curto) |
| Dispatch | Hook async dentro de `_shared/pipeline-move.ts` após move bem-sucedido com `source LIKE 'auto:%'` |
| Toggle | `automation.post_move_verifier.enabled` = true |
| Whitelist | `automation.post_move_verifier.rules_enabled` (JSON array). Hoje `[]` → roda em **todos** os moves auto. |

### Payload recebido

```json
{ "lead_id", "from_stage_id", "to_stage_id", "source", "rule_key" }
```

### Contexto montado

- Últimos 5 `lead_events` (qualquer tipo)
- Nomes dos stages from/to
- Tags atuais

### Prompt

```text
[system]
Você é um revisor curto de movimentações de pipeline CRM médico.
Responda APENAS via schema: verdict ∈ {sim, nao, incerto}, confidence ∈ [0,1],
reason ≤ 200 chars em PT-BR.
Use 'nao' apenas quando há evidência clara de que o move foi inadequado dado o histórico.

[user]
Move automático aplicado:
- regra/source: <source>
- de: <fromName>
- para: <toName>
- tags atuais: <tags>

Últimos 5 eventos do lead:
[YYYY-MM-DD HH:mm] <type>: <payload truncado a 200 chars>
...

Esse move faz sentido?
```

### Schema

```ts
{ verdict: 'sim'|'nao'|'incerto', confidence: 0..1, reason: ≤200 chars }
```

### Critério de warning

```
warning = verdict === 'nao' && confidence >= 0.8
```

### Ações quando warning

1. INSERT `lead_events.type='post_move_disagreement'` com payload completo.
2. `leads.tags += ['precisa_atencao_humana', 'post_move_warning']` (merge).
3. **Não reverte o move.** Quem decide é o humano olhando a tag.

### Quando NÃO warning

INSERT `lead_events.type='post_move_audit_ok'`. Sem mexer em tags.

## Diferença A1 × A2

| | A1 position-auditor | A2 post-move-verifier |
|---|---|---|
| Quando | Diariamente, leads parados | Imediatamente após cada move `auto:*` |
| Modelo | gpt-5-mini | gpt-5-nano |
| Output | sugere stage destino | binário sim/não no move ocorrido |
| Threshold | 0.75 | 0.80 |
| Cria task | sim | não |
| Tags em discordância | `precisa_atencao_humana` + `auditor_sugere_<X>` | `precisa_atencao_humana` + `post_move_warning` |
| Evento ok | `position_audit_ok` | `post_move_audit_ok` |
| Evento warning | `position_audit_disagreement` | `post_move_disagreement` |

## Métricas para acompanhar

```sql
-- Total de discordâncias últimos 7d
SELECT type, count(*) FROM lead_events
WHERE type IN ('position_audit_disagreement','position_audit_ok',
               'post_move_disagreement','post_move_audit_ok')
  AND created_at > now() - interval '7 days'
GROUP BY type;

-- Leads com tag de auditor pendente
SELECT id, name, tags FROM leads
WHERE tags && ARRAY['precisa_atencao_humana','post_move_warning']
   OR EXISTS (
     SELECT 1 FROM unnest(tags) t WHERE t LIKE 'auditor_sugere_%'
   );
```

---
title: "Playbook — Auditar um lead"
topic: kanban
kind: howto
audience: agent
updated: 2026-08-07
summary: "Como reconstituir o que aconteceu com um card, com os caminhos de payload verificados. Inclui árvore de decisão para 'o lead não moveu'."
related_docs:
  - docs/pipeline/runtime/_registry/events.md
---

<!-- docs-verify:allow-stale-paths — cita os caminhos errados de propósito, para avisar -->

# Playbook — Auditar um lead

⚠️ **Use os caminhos deste arquivo.** Docs antigos circulam com
`applied.custom_fields_rejected` (falta um nível) e `type='auto:maestro'` (não existe) — os
dois retornam vazio e passam a impressão errada de que o sistema está parado.

## 1. Estado atual

```sql
SELECT l.id, l.name, ps.name AS stage, l.stage_changed_at,
       l.tags, l.custom_fields, l.custom_fields_last_human_edit,
       l.needs_ai_review, l.ai_review_reasons, l.last_classified_at,
       l.last_processed_message_id_classifier
FROM leads l LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
WHERE l.id = '<uuid>';
```

## 2. Histórico de movimentação

```sql
SELECT moved_at, source, reason,
       f.name AS de, t.name AS para,
       metadata->>'rule_key' AS regra,
       metadata->'wiped_keys' AS chips_limpos,
       moved_by_user_id IS NOT NULL AS foi_humano
FROM lead_stage_history h
LEFT JOIN pipeline_stages f ON f.id = h.from_stage_id
LEFT JOIN pipeline_stages t ON t.id = h.to_stage_id
WHERE h.lead_id = '<uuid>' ORDER BY moved_at DESC;
```

`source` diz quem moveu: `manual`/`ui` = humano · `auto:classifier-*` = IA · `auto:*` = regra
determinística.

## 3. O que a IA decidiu

```sql
SELECT created_at,
       payload->'classification'->>'stage_suggestion'          AS sugeriu,
       payload->'classification'->>'intent'                    AS intent,
       payload->'classification'->>'confidence'                AS conf,
       payload->'applied'->'stage_suggestion_only'->>'reason'  AS resultado,
       payload->'applied'->'stage_suggestion_only'->>'path'    AS caminho
FROM lead_events
WHERE lead_id = '<uuid>' AND type = 'auto:classifier'
ORDER BY created_at DESC LIMIT 10;
```

## 4. Árvore de decisão — "o lead não moveu"

Leia o `resultado` da query acima:

| `reason` | Diagnóstico |
|---|---|
| `locked_in_paciente_antigo` | Guard D3. Por design |
| `ai_scheduling_disabled_by_human_transition` | Destino em `HUMAN_SCHEDULING_STAGES`. Por design — só humano e `appointment-sync` colocam leads em stages de agendamento |
| `stage_alias_not_found` | **Causa mais comum.** Canônico sem linha em `stage_canonical_aliases`. Ver [`add-stage.md`](./add-stage.md) |
| `general_guard_failed:confidence<0.8` | Maestro inseguro. Veja o `summary` em `payload.agents` |
| `nurture_guard_failed:*` | A string lista qual guard falhou |
| `b2b_guard_failed:*` | idem |
| `gate_g3_disabled:<key>` | Toggle não seedado ou desligado. Ver [`_registry/toggles.md`](../_registry/toggles.md) |
| `gate_g2_destination_locked:*` | Stage destino com `lock_auto_move` |
| `clinic_not_allowlisted` | Clínica fora de `pipeline_automation_allowlist` |
| `idempotent:*` | Já tentou com a mesma chave. Esperado |
| `already_at_destination` | Já estava lá |
| `strict_no_move` | Nenhum caminho se aplicou |
| `recent_human_move_24h` | ❌ **inalcançável** — o guard é código morto. Se aparecer, é outra coisa |

## 5. Campos e tags

```sql
SELECT created_at,
       payload->'applied'->'custom_fields'->'set'            AS campos_aplicados,
       payload->'applied'->'custom_fields'->'blocked_by_g10' AS bloqueados_g10,
       payload->'applied'->'custom_fields'->'rejected'       AS rejeitados,
       payload->'applied'->'tags'->'added'                   AS tags_add,
       payload->'applied'->'tags'->'removed_computed'        AS tags_rem,
       payload->'applied'->'tags'->'dropped_by_whitelist'    AS tags_descartadas
FROM lead_events
WHERE lead_id = '<uuid>' AND type = 'auto:classifier'
ORDER BY created_at DESC LIMIT 5;
```

Tags sumindo → cheque `dropped_by_whitelist` **antes** de qualquer outra hipótese.

## 6. Datas

```sql
SELECT created_at, payload->'date_parser' AS datas
FROM lead_events
WHERE lead_id = '<uuid>' AND type = 'auto:classifier'
  AND jsonb_array_length(COALESCE(payload->'date_parser','[]')) > 0
ORDER BY created_at DESC LIMIT 5;
```

`rejected_reason`: `anchor_invalid` (ISO da mensagem inválido) · `ambiguous_or_past`
(`parseFutureDateInTZ` não resolveu) · `too_far_future` (> 90 dias).

## 7. O lead está preso na fila?

```sql
SELECT id, needs_ai_review, ai_review_queued_at, ai_review_reasons, last_classified_at
FROM leads WHERE id = '<uuid>';
```

`needs_ai_review=true` com `ai_review_queued_at` antigo → o tick não alcançou. Motivos comuns:
clínica fora da allowlist, backoff após falhas, ou fila saturada por leads de outras clínicas.

## 8. Custo e latência

```sql
SELECT created_at, payload->'agents' AS agentes, payload->'cost' AS custo
FROM lead_events
WHERE lead_id = '<uuid>' AND type = 'auto:classifier'
ORDER BY created_at DESC LIMIT 3;
```

⚠️ `latency_ms` de `agendador`, `typifier` e `movimentador` recebem todos o mesmo valor (o
tempo do `Promise.all`) — não dá para separar o custo real dos três.

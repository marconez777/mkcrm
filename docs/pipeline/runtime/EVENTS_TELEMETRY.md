---
title: "Telemetria — lead_events, lead_stage_history, pipeline_runs"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-20
summary: "Catálogo de tipos de evento em lead_events com volume real (últimos 30d), sources de lead_stage_history, estrutura de pipeline_runs/run_items e shape do payload V6 do classifier (5 agentes). Queries de diagnóstico prontas."
code_refs:
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/pipeline-classify/index.ts
  - supabase/functions/pipeline-position-auditor/index.ts
  - supabase/functions/pipeline-post-move-verifier/index.ts
related_docs:
  - docs/pipeline/runtime/DATABASE_LIVE.md
  - docs/pipeline/runtime/CLASSIFIER.md
---

# Telemetria do pipeline

## Sources de `lead_stage_history.source`

Toda movimentação passa por `_shared/pipeline-move.ts`, que grava `source`. Padrões em uso:

| Prefixo | Quem grava | Significado |
|---|---|---|
| `manual` | UI Kanban / dialogs | drag-and-drop ou move via menu (aplica `manual_lock_until=now()+7d`) |
| `ui` | outras superfícies UI | move via página de lead, importações, etc. |
| `auto:novo-lead` | trigger novo lead | criação |
| `auto:secretary-replied` | trigger inbound msg | Novo → Qualificação |
| `auto:appointment-sync` | trigger appointments | varia com `status×kind` |
| `auto:appointment-agendado` / `realizado` / `faltou` / `cancelado` | (legado — hoje tudo é `auto:appointment-sync`) | — |
| `auto:followup-7d` | inactivity cron | move para Nutrição inativa |
| `auto:ciclo-concluido` | field-changed | move para Paciente antigo + lock 90d |
| `auto:classifier-b2b` | classifier (is_b2b + conf ≥ 0.9) | move para B2B / Stakeholders |
| `auto:classifier-stage` | classifier path genérico | move para `stage_suggestion` |
| `system:d1-eliminate-procedimento-pago` | migration `20260618021516` | move histórico dos 9 leads |
| `reator:<x>` | reservado, sem uso atual | — |
| `system:<x>` | migrations / scripts admin | — |

## Tipos de `lead_events` (volume últimos 30d)

| type | n | grava | descrição |
|---|---|---|---|
| `stage_changed` | 3044 | trigger antigo em UPDATE de `stage_id` | espelho da history |
| `pipeline_changed` | 2084 | trigger `sync_lead_pipeline_id` | derivação de `pipeline_id` |
| `custom_fields_changed` | 1931 | trigger | diff antes/depois |
| `ai_review_queued` | 1140 | webhook/queue | lead entrou na fila do classifier |
| `ai_fields_extracted` | 533 | sistema **antigo** (deprecated) | — |
| `pipeline_fallback_used` | 490 | `resolveStageId` quando alias não bate | sinaliza drift de aliases |
| `stage_auto_moved` | 281 | sistema antigo | — |
| **`auto:classifier`** | 154 | `pipeline-classify` | classificação completa + `applied{}` |
| `stage_changed_by_ai` | 120 | sistema antigo | — |
| **`auto:summarize`** | 99 | `runSummarize` | `{reason, new_messages, chars}` |
| `form_submission` | 62 | form | |
| `date_tz_backfill` | 9 | migration de backfill TZ | |
| `attendant_changed` | 8 | manual | |
| `custom_field_auto_set` | 8 | sistema | |
| **`pipeline_move_attempted`** | 6 | `pipelineMove()` G4 | chave de idempotência |
| **`pagamento_alegado`** | 4 | `runPaymentAlleged` | |
| **`auto:renovacao-receita`** | 4 | `runRenovacaoReceita` | |
| `wa_redirect_template_detected` | 3 | wa-redirect | |
| **`auto:objection-suggest`** | 2 | `runObjectionSuggest` | |
| **`auto:payment-confirmed`** | 1 | `runPaymentConfirmed` | |
| `duplicate_detected` | 1 | dedup | |

Tipos esperados mas ainda **0 ocorrências** no snapshot:

`position_audit_ok` · `position_audit_disagreement` · `post_move_audit_ok` · `post_move_disagreement` · `auto:novo-lead` · `auto:secretary-replied` · `auto:appointment-sync` · `auto:followup-*` · `auto:reactivation` · `auto:ciclo-concluido` · `auto:modality-guard` · `auto:human-reactor` · `auto:judicializacao` · `auto:stage-bindings` · `nf_solicitada` · `manual:unlock`

> A ausência de `auto:novo-lead`, `auto:secretary-replied` e `auto:appointment-sync` é **suspeita**: os toggles estão ligados e os triggers estão criados desde a migration `20260618022933`. Possíveis causas: (a) tráfego baixo nesses 30d, (b) `pg_net.http_post` está falhando silenciosamente (a função wrapper engole exceções com `RAISE WARNING`), (c) edge function está reagindo mas só registra o evento dentro do success path do `pipelineMove`. Vale checar `pg_net.deliveries` se houver suspeita.

## Payload do `auto:classifier` (envelope V6, `version: 3`)

A partir de 2026-06-20 (refactor V6 — 5 agentes), o payload inclui o bloco `agents` com modelo + latência + flag `ran` por agente. O dispatcher em `pipeline-classify/index.ts:133` retorna `version: 3` (envelope V6, mesmo número desde o refator multi-step — não é "V3 de 3 agentes").

```jsonc
{
  "version": 3,
  "mode": "full",
  // Campos da classificação (output do Maestro mesclado com o Resumidor):
  "stage_suggestion": "Qualificação",
  "intent": "agendamento",
  "confidence": 0.82,
  "is_b2b": false,
  "tags_suggested": ["interessado"],
  "custom_fields_patch": { "consulta_agendada_em": "2026-06-18T10:30:00-03:00" },
  "reasons": ["..."],
  "mentioned_dates": [
    { "raw": "quinta-feira às 14h", "anchor_iso": "2026-06-18T10:05:00-03:00", "kind": "consulta" }
  ],

  // NOVO V6 — telemetria por agente:
  "agents": {
    "summarizer_model":   "gpt-4o",
    "agendador_model":    "gpt-5-mini",
    "typifier_model":     "gpt-5-mini",
    "movimentador_model": "gpt-5-mini",
    "maestro_model":      "gpt-5",
    "summary_chars": 412,
    "summary": "Paciente …",
    "latency_ms": {
      "summarizer": 1820, "agendador": 940, "typifier": 940,
      "movimentador": 940, "maestro": 1110
    },
    "ran": {
      "summarizer": true, "agendador": true, "typifier": true,
      "movimentador": true, "maestro": true
    }
  },

  // Telemetria do que foi de fato aplicado:
  "applied": {
    "stage_move": {
      "applied": true,
      "from": "<uuid|null>",
      "to":   "<uuid>",
      "path": "b2b" | "generic" | "guard_d3",
      "reason": "ok" | "low_confidence" | "below_threshold(0.75)" | "same_stage"
              | "stage_alias_not_found:<canon>" | "gate_g1_manual_lock_until:<iso>"
              | "gate_g3_disabled:<key>" | "idempotent:<key>" | "toggle_off"
              | "locked_in_paciente_antigo" | "b2b_guard_failed:<...>",
      "suggestion": "<canon>",
      "confidence": 0.82
    },
    "tags_diff": {
      "added":   ["interessado"],
      "removed": ["1ª consulta"],
      "requested_remove": ["1ª consulta", "antigo"]
    },
    "custom_fields": { "consulta_agendada_em": "2026-06-18T10:30:00-03:00" },
    "custom_fields_rejected": [
      { "key": "consulta_agendada_em", "raw_value": "2025-01-10T08:00:00Z", "reason": "in_past" }
    ],
    "blocked_by_g10": []
  }
}
```

> **Compat V2/V3**: a UI `/pipeline-runs` e `/metrics/ai-usage` ainda tolera
> payloads antigos (V2 monolítico: sem bloco `agents`; V5 de 3 agentes: bloco
> `agents` só com `summarizer`/`typifier`/`maestro`). Renderiza "—" para os
> agentes ausentes do payload.

### Operations em `ai_usage` (1 linha por agente por execução)

`agent-core.ts::recordStep` grava até 5 linhas por execução do classifier:

| `operation` | `model` | Observação |
|---|---|---|
| `classifier:summarizer` | `google/gemini-2.5-flash` ou OpenAI fallback | sempre primeiro |
| `classifier:agendador` | `google/gemini-2.5-flash-lite` ou OpenAI fallback | paralelo |
| `classifier:typifier` | `google/gemini-2.5-flash` ou OpenAI fallback | paralelo |
| `classifier:movimentador` | `google/gemini-2.5-flash-lite` ou OpenAI fallback | paralelo |
| `classifier:maestro` | `google/gemini-2.5-flash` ou OpenAI fallback | sempre por último (se 2 passou) |

Em erro, a linha do agente que falhou tem `status='error'`, `error` truncado a 500 chars, `source='classifier-runtime'`, `provider`, `agent_step`, `error_category` e `error_details`. Desde a Fase 15, os paralelos usam `Promise.allSettled`: falha de um subagente não marca os outros como erro. Erros de schema tentam fallback JSON textual antes de virar falha final.

## Estrutura `pipeline_runs` / `pipeline_run_items`

Usado pelo executor manual em `/admin/pipeline-automations`. Snapshot pode estar vazio se ninguém disparou runs recentes.

```sql
pipeline_runs
  id, clinic_id, pipeline_id, status (queued|running|done|error|cancelled),
  requested_by (auth.users), parent_run_id (chained execution),
  scope jsonb, totals jsonb, comment,
  started_at, finished_at, last_heartbeat_at, created_at, updated_at

pipeline_run_items
  id, run_id, clinic_id, lead_id, stage_id, stage_name,
  step text, status (pending|ok|skipped|error),
  result jsonb, error text, comment text, retry_requested bool,
  started_at, finished_at
```

Unique index: 1 run ativo por clínica (`WHERE status IN ('queued','running')`).

Watchdog `mark_stale_pipeline_runs_as_error()` (manual ou cron) marca como erro runs sem heartbeat ≥3min.

## Queries úteis

### "Por que esse lead não moveu?"

```sql
SELECT created_at, type, payload->'applied'->'stage_move' AS stage_move
FROM lead_events
WHERE lead_id = '<uuid>' AND type = 'auto:classifier'
ORDER BY created_at DESC LIMIT 10;
```

### Auditoria de discordâncias do A1/A2 7d

```sql
SELECT type, count(*),
       avg((payload->>'confidence')::float) AS avg_conf
FROM lead_events
WHERE type IN ('position_audit_disagreement','post_move_disagreement')
  AND created_at > now() - interval '7 days'
GROUP BY type;
```

### Custom fields rejected pelo sanitizer

```sql
SELECT lead_id, created_at,
       jsonb_array_elements(payload->'applied'->'custom_fields_rejected') AS rejection
FROM lead_events
WHERE type='auto:classifier'
  AND jsonb_array_length(payload->'applied'->'custom_fields_rejected') > 0
ORDER BY created_at DESC;
```

### Última movimentação de um lead

```sql
SELECT moved_at, source, reason, metadata,
       (SELECT name FROM pipeline_stages WHERE id=from_stage_id) AS from_name,
       (SELECT name FROM pipeline_stages WHERE id=to_stage_id) AS to_name
FROM lead_stage_history
WHERE lead_id='<uuid>'
ORDER BY moved_at DESC LIMIT 10;
```

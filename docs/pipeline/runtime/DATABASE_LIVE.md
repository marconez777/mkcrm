---
title: "Banco de dados — runtime do pipeline"
topic: database
kind: reference
audience: agent
updated: 2026-06-18
summary: "Tabelas e colunas-chave que sustentam o pipeline: leads (44 cols), lead_stage_history, lead_events, lead_tasks, pipeline_stages, stage_canonical_aliases, pipeline_automation_allowlist, pipeline_runs/run_items, stage_sequence_bindings, app_settings. Triggers PG e crons pg_cron."
code_refs:
  - supabase/migrations/20260618021516_904d3210-ac71-4615-ba12-702242fec178.sql
  - supabase/migrations/20260618022933_e4ca1829-7d6c-4cd1-8f70-e5bcb788f35a.sql
  - supabase/migrations/20260618024624_8bd1dfc0-03f0-41ae-83ac-e49ca377057f.sql
  - supabase/migrations/20260618032209_4847f9d6-4c12-4459-8e94-ebf9793c830b.sql
related_docs:
  - docs/pipeline/runtime/EVENTS_TELEMETRY.md
  - docs/pipeline/runtime/ARCHITECTURE.md
  - docs/pipeline/DATABASE.md
---

# Banco de dados — runtime

## Tabela `leads` (44 colunas) — colunas-chave usadas pelo pipeline

| Coluna | Tipo | Quem escreve | Quem lê |
|---|---|---|---|
| `id` | uuid PK | — | tudo |
| `clinic_id` | uuid | seeder/form/webhook | tudo |
| `pipeline_id` | uuid | trigger `sync_lead_pipeline_id` (derivado de stage_id) | tudo |
| `stage_id` | uuid → `pipeline_stages.id` | `pipelineMove()`, manual UI | tudo |
| `stage_changed_at` | timestamptz | `pipelineMove()`, manual | A1 (critério ≥7d) |
| `manual_lock_until` | timestamptz | manual Kanban, `unlockLeadManually`, `auto:ciclo-concluido` (90d) | G1 em `pipelineMove()` |
| `position` | int | manual Kanban | UI |
| `tags` | text[] | classifier/A1/A2/regras auto + manual | tudo |
| `custom_fields` | jsonb | classifier (patch), regras auto, manual | tudo |
| `ai_summary` | text (≤800) | `runSummarize` | UI/contexto |
| `last_processed_message_id_classifier` | uuid | classifier (watermark) | classifier (fila) |
| `last_processed_message_id_summarizer` | uuid | summarizer (watermark) | summarizer |
| `last_classified_at` | timestamptz | classifier | métricas |
| `needs_ai_review` | bool | webhook (true), classifier (false) | classifier (fila) |
| `ai_review_reasons` | text[] | webhook ('pipeline-classifier'), classifier (remove) | classifier (fila) |
| `ai_review_queued_at` | timestamptz | webhook, classifier (10min adiante em erro) | classifier (fila) |
| `archived_at` | timestamptz | manual | inactivity/reactivation (filtra) |
| `is_internal_contact` | bool | manual | inactivity (filtra) |
| `last_message_at` | timestamptz | evolution-webhook | inactivity (cutoff) |
| `last_human_activity_at` | timestamptz | evolution-webhook | inactivity tier 24h |
| `updated_at` | timestamptz | trigger `set_updated_at` | human-reactor (cutoff 7d) |
| `created_at` | timestamptz | default | classifier (LeadContext age) |

## Tabelas auxiliares do pipeline

### `pipeline_stages`
```sql
id uuid PK
clinic_id uuid
pipeline_id uuid
name text
position int
is_terminal bool         -- B2B e Desqualificado=true
lock_auto_move bool      -- nenhum stage hoje
color text
```

### `stage_canonical_aliases` (migration `20260618022933`)
```sql
id uuid PK
clinic_id uuid
pipeline_id uuid
stage_id uuid → pipeline_stages
canonical_name text      -- "Novo", "Qualificação", etc.
UNIQUE (pipeline_id, canonical_name)
```
Usado por `resolveStageId()` em classifier e deterministic para traduzir nome canônico → stage_id real do pipeline da clínica.

### `lead_stage_history`
```sql
id, clinic_id, lead_id
from_stage_id, to_stage_id
source text              -- 'auto:<rule>' | 'reator:<x>' | 'system:<x>' | 'manual' | 'ui'
reason text
metadata jsonb           -- { idempotency_key, rule_key, ... }
moved_at timestamptz
```
Escrita por `pipelineMove()` (G5). Lida pelo classifier (`recentStageHistory` no LeadContext, últimos 8).

### `lead_events`
```sql
id, clinic_id, lead_id, type text, payload jsonb, created_at
```
Tipos atualmente em uso (últimos 30d):

| type | volume 30d | quem grava |
|---|---|---|
| `stage_changed` | 3044 | trigger antigo |
| `pipeline_changed` | 2084 | trigger `sync_lead_pipeline_id` |
| `custom_fields_changed` | 1931 | trigger |
| `ai_review_queued` | 1140 | webhook/queue |
| `ai_fields_extracted` | 533 | sistema antigo |
| `pipeline_fallback_used` | 490 | resolveStageId fallback |
| `stage_auto_moved` | 281 | sistema antigo / `pipelineMove` legado |
| `auto:classifier` | 154 | `pipeline-classify` |
| `stage_changed_by_ai` | 120 | sistema antigo |
| `auto:summarize` | 99 | `runSummarize` |
| `form_submission` | 62 | form |
| `pipeline_move_attempted` | 6 | `pipelineMove()` G4 (idempotência) |
| `auto:renovacao-receita` | 4 | `runRenovacaoReceita` |
| `pagamento_alegado` | 4 | `runPaymentAlleged` |
| `wa_redirect_template_detected` | 3 | wa-redirect |
| `auto:objection-suggest` | 2 | `runObjectionSuggest` |
| `auto:payment-confirmed` | 1 | `runPaymentConfirmed` |
| `duplicate_detected` | 1 | dedup |

Tipos esperados mas ainda **sem ocorrência** no snapshot:

```
position_audit_ok, position_audit_disagreement,
post_move_audit_ok, post_move_disagreement,
auto:novo-lead, auto:secretary-replied, auto:appointment-sync,
auto:followup-24h, auto:followup-3d, auto:followup-7d,
auto:reactivation, auto:ciclo-concluido, auto:modality-guard,
auto:human-reactor, auto:judicializacao, auto:stage-bindings,
nf_solicitada, manual:unlock
```

### `lead_tasks`
```sql
id, clinic_id, lead_id, title, due_at, done_at, created_at
```
Escrita por: A1 (audit), human-reactor, runNfTask, runPaymentAlleged, runJudicializacao, runRenovacaoReceita.

### `lead_internal_notes`
```sql
id, clinic_id, lead_id, text, author_name, created_at
```
Escrita por `runObjectionSuggest` (`author_name='auto:objection-suggest'`).

### `pipeline_automation_allowlist` (migration `20260618032209`)
```sql
clinic_id uuid PK
enabled bool DEFAULT true
notes text
```
Cache 30s em `_shared/pipeline-allowlist.ts`. Atualmente: 1 entrada para Clínica ÓR.

### `pipeline_runs` + `pipeline_run_items` (executor manual)
Estrutura padrão `run + items`, com `status`, `heartbeat`, `parent_run_id`. Watchdog `mark_stale_pipeline_runs_as_error()` marca runs sem heartbeat ≥3min.

UI consome via realtime (`REPLICA IDENTITY FULL` aplicado).

### `stage_sequence_bindings` (migration `20260618021516`)
```sql
clinic_id, stage_id, sequence_id
trigger 'on_enter' | 'on_exit'    -- código atual só usa 'stage_enter' (?)
enabled bool
UNIQUE (clinic_id, stage_id, sequence_id, trigger)
```
> **Mismatch**: o CHECK aceita `'on_enter'|'on_exit'` mas `applyStageBindings()` filtra por `trigger='stage_enter'`. Em uma das duas o nome diverge — verificar antes de criar bindings ativos.

### `app_settings`
Pares `key text PK, value text/jsonb`. Toggles, thresholds, schemas — usado por toda regra. Lista completa de chaves `automation.*` em `README.md` da pasta runtime.

## Triggers Postgres → `pipeline-deterministic` (via pg_net)

Função wrapper `public.notify_pipeline_deterministic(_action, _payload)` em `20260618022933`:

```plpgsql
PERFORM extensions.http_post(
  url := 'https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/pipeline-deterministic',
  headers := { Content-Type, Authorization: Bearer <anon>, apikey: <anon> },
  body := jsonb_build_object('action', _action) || _payload
);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING ...;   -- nunca quebra transação
```

Triggers criados:

| Trigger | Em | Action |
|---|---|---|
| `trg_leads_auto_novo_lead` | AFTER INSERT em `leads` | `novo-lead` |
| `trg_messages_auto_secretary` | AFTER INSERT em `messages` (filtra `from_me=true` na função) | `secretary-replied` |
| `trg_appointments_auto_sync` | AFTER INSERT OR UPDATE OF status em `appointments` | `appointment-sync` |
| `trg_leads_auto_field_changed` | AFTER UPDATE OF custom_fields em `leads` | `field-changed` (envia old + new) |

> O Authorization usa o **anon key**. As regras em `pipeline-deterministic` rodam com service_role internamente.

## Crons `pg_cron`

| Job | Schedule | Endpoint |
|---|---|---|
| `pipeline-classify-tick` | `* * * * *` (1/min) | `pipeline-classify` `{action:'tick'}` |
| `pipeline-inactivity-tick` | `*/15 * * * *` | `pipeline-deterministic` `{action:'inactivity-tick'}` |
| `pipeline-reactivation-tick` | `0 7 * * *` (04h BRT) | `pipeline-deterministic` `{action:'reactivation-tick'}` |
| `pipeline-human-reactor-tick` | `0 8 * * *` (05h BRT) | `pipeline-deterministic` `{action:'human-reactor-tick'}` |
| `pipeline-position-auditor-daily` | `0 6 * * *` (03h BRT) | `pipeline-position-auditor` `{action:'tick'}` |
| `classifier-daily-batch` | `0 */3 * * *` | `pipeline-run-executor` (batch admin) |
| `dedup-leads-tick-daily` | `30 7 * * *` | `dedup-leads-tick` |
| `watch-stale-leads-daily` | `0 6 * * *` | (não auditado aqui) |

## Função utilitária `reset_ai_classifications(clinic_id)` (migration `20260618034546`)

`SECURITY DEFINER` granted to `service_role`. Apaga `custom_fields` (chaves: `qualificacao`, `procedimento_interesse`, `tentou_pagamento`, `pagamento_confirmado`, `tentou_agendar`, `consulta_agendada_em`, `procedimento_agendado_em`), zera `ai_summary`, `last_classified_at`, watermarks, `needs_ai_review`, `ai_review_reasons`, `ai_review_queued_at`, e remove `lead_thread_classifications` da clínica.

Útil para reprocessar do zero. Acessível via `pipeline-run-executor` action `reset_ai_classifications`.

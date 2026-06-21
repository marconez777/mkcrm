---
title: "Auditoria de gatilhos — Pipeline & Automações"
topic: kanban
kind: audit
audience: agent
updated: 2026-06-21
summary: "Snapshot vivo (consultado direto em cron.job e pg_trigger) de TODOS os gatilhos que disparam o pipeline V6 e as automações operacionais. Inclui crons pg_cron, triggers Postgres, webhooks públicos e ações manuais. Marca gaps de documentação."
code_refs:
  - supabase/functions/pipeline-run-executor/index.ts
  - supabase/functions/pipeline-classify/index.ts
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/automations-tick/index.ts
  - supabase/functions/sequence-tick/index.ts
related_docs:
  - docs/pipeline/runtime/DATABASE_LIVE.md
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
---

# Auditoria de gatilhos (2026-06-21)

> Fonte de verdade desta página: `SELECT jobname, schedule FROM cron.job` + `pg_trigger` (schema `public`) + `supabase/config.toml`. Regere com os comandos no final.

## 1. Crons `pg_cron` (29 jobs ativos no projeto)

### 1.1 Pipeline (linha de montagem V6 + auditores + housekeeping)

| Job | Schedule | Endpoint | Doc |
|---|---|---|---|
| `pipeline-classify-tick` | `* * * * *` | `pipeline-classify {action:'tick'}` → V6 (5 agentes) | ✅ DATABASE_LIVE |
| `pipeline-inactivity-tick` | `*/15 * * * *` | `pipeline-deterministic {action:'inactivity-tick'}` | ✅ |
| `pipeline-reactivation-tick` | `0 7 * * *` (04h BRT) | `pipeline-deterministic {action:'reactivation-tick'}` | ✅ |
| `pipeline-human-reactor-tick` | `0 8 * * *` (05h BRT) | `pipeline-deterministic {action:'human-reactor-tick'}` | ✅ |
| `pipeline-position-auditor-daily` | `0 6 * * *` (03h BRT) | `pipeline-position-auditor {action:'tick'}` (A1) | ✅ |
| `classifier-daily-batch` | `0 */3 * * *` | `pipeline-run-executor` (batch admin) | ✅ |
| `dedup-leads-tick-daily` | `30 7 * * *` | `dedup-leads-tick` | ✅ |
| `watch-stale-leads-daily` | `0 6 * * *` | `watch-stale-leads` | ✅ |
| `outreach-recovery-tick-daily` | `0 7 * * *` | `outreach-recovery-tick` | ⚠️ GAP — adicionar em DATABASE_LIVE |

### 1.2 Automações da ferramenta (UI `/automations`, sequências, broadcasts, e-mail, relatórios)

| Job | Schedule | Endpoint | Doc |
|---|---|---|---|
| `automations-tick-every-5-min` | `*/5 * * * *` | `automations-tick` (regras `public.automations`) | ⚠️ GAP |
| `sequence-tick-every-minute` | `* * * * *` | `sequence-tick` (`message_sequence_*`) | ⚠️ GAP |
| `agent_followups_tick` | `*/5 * * * *` | `agent-followups-tick` | ⚠️ GAP |
| `broadcast-tick-every-minute` | `* * * * *` | `broadcast-tick` | ✅ |
| `scheduled-messages-dispatch` | `* * * * *` | `scheduled-dispatcher` | ✅ |
| `scheduled-report-tick` | `* * * * *` | `scheduled-report-tick` | ✅ |
| `process-scheduled-campaigns-5min` | `*/5 * * * *` | `process-scheduled-campaigns` | ✅ |
| `process-email-queue-every-minute` | `10s` | `process-email-queue` | ✅ |
| `email-automations-tick` | `*/5 * * * *` | `email-automations-tick` | ✅ |
| `email-daily-summary` | `0 11 * * *` | `daily-summary` | ✅ |
| `refresh-email-metrics-daily` | `*/15 * * * *` | RPC interna | ✅ |
| `evolution-collect-leads-30min` | `*/30 * * * *` | `evolution-collect-leads` | ✅ |
| `evolution-health-every-minute` | `* * * * *` | `evolution-health` | ✅ |
| `external-webhook-dispatcher-tick` | `* * * * *` | webhook dispatcher | ✅ |

### 1.3 Housekeeping / admin

| Job | Schedule | Endpoint |
|---|---|---|
| `ai-analyst-run-daily` | `0 3 * * *` | `ai-analyst-run` |
| `ai-spend-daily-reset` | `5 3 * * *` | RPC `reset blocked` |
| `cleanup-webhook-dedup` | `*/10 * * * *` | RPC |
| `cleanup-webhook-events-daily` | `0 3 * * *` | RPC |
| `cron-expire-manual-grants-daily` | `10 3 * * *` | `cron-expire-manual-grants` |
| `mark-overdue-invoices-daily` | `0 3 * * *` | RPC |

## 2. Triggers Postgres do funil

### 2.1 Já documentados em `DATABASE_LIVE.md §Triggers`

`trg_leads_auto_novo_lead`, `trg_messages_auto_secretary`, `trg_appointments_auto_sync`, `trg_leads_auto_field_changed`.

### 2.2 Existem em `pg_trigger`, **faltam** na doc (gap)

| Trigger | Tabela | Quando | O que faz |
|---|---|---|---|
| `trg_messages_enqueue_classifier` | `messages` | AFTER INSERT | Enfileira o lead para `pipeline-classify` (entrada principal da V6 a partir de WhatsApp) |
| `trg_stop_sequences_on_reply` | `messages` | AFTER INSERT (paciente) | Cancela enrollments ativos em `message_sequence_enrollments` |
| `messages_lead_needs_extraction` | `messages` | AFTER INSERT | Marca `needs_ai_review=true` para forçar passada da V6 |
| `trg_bump_human_activity_from_msg` / `_from_note` | `messages` / `lead_internal_notes` | AFTER INSERT | Atualiza `last_human_activity_at` (afeta lock manual + reator humano) |
| `trg_appointments_recompute` | `appointments` | AFTER INS/UPD | Recalcula `status_consulta`/`status_procedimento` no lead |
| `leads_stage_changed`, `trg_lead_stage_history`, `trg_enroll_on_stage_change` | `leads` | AFTER UPDATE OF `stage_id` | Grava histórico, dispara `stage_sequence_bindings`, emite eventos |
| `trg_leads_sync_pipeline` | `leads` | BEFORE UPDATE | Mantém `pipeline_id` derivado de `stage_id` |
| `trg_sync_lead_ai_settings_stage` | `leads` | AFTER UPDATE | Sincroniza `lead_ai_settings.current_stage` |
| `trg_lead_risk_handler` | `leads` | AFTER UPDATE | Aplica/remove tags de risco (objeção/precisa atenção humana) |
| `trg_validate_lead_custom_fields_enums` | `leads` | BEFORE INS/UPD | Valida enums `qualificacao`, `tentou_*`, etc. |
| `trg_track_custom_fields_human_edits` | `leads` | BEFORE UPDATE | Marca edição humana para não ser sobrescrito pela IA |

### 2.3 Triggers de coerência multi-tenant (defesa cross-clinic)

| Trigger | Tabela | Quando | Função | Origem |
|---|---|---|---|---|
| `trg_leads_enforce_coherence` | `leads` | BEFORE INS/UPD OF `clinic_id, pipeline_id, stage_id` | `enforce_lead_clinic_coherence()` | KNOWN_ISSUES §-5 (2026-06-21) |
| `trg_automation_runs_clinic_coherence` | `automation_runs` | BEFORE INS/UPD OF `automation_id, lead_id` | `enforce_automation_run_clinic_coherence()` | KNOWN_ISSUES §-4 (2026-06-21) |

Ambos são `SECURITY DEFINER` com `SET search_path = public` e levantam `EXCEPTION` (errcode `check_violation`) ao detectar mistura de clínicas. **Última linha de defesa** — não confiar para correção silenciosa; o filtro `clinic_id` deve sempre existir na query da edge function.

### 2.4 Outros triggers de domínio (fora do funil)

`email_queue_health_trigger`, `email_logs_bounce_health_trigger`, `trg_email_queue_campaign_counters`, `trg_cancel_pending_on_unsubscribe`, `trg_ai_usage_spend_guard`, `trg_assert_clinic_id` em várias tabelas. Não fazem parte da V6 mas valem citar.


## 3. Webhooks públicos (`verify_jwt=false` em `config.toml`)

| Function | Quem chama | Efeito no pipeline |
|---|---|---|
| `evolution-webhook` | Evolution API (WhatsApp) | Cria `messages` → dispara `trg_messages_enqueue_classifier` → V6 |
| `external-lead-capture` | Sites/integrações | Cria `leads` → `trg_leads_auto_novo_lead` |
| `forms-ingest` | Formulários públicos | Idem |
| `eduzz-webhook` | Eduzz | `pipeline-payment-webhook` flow |
| `pipeline-payment-webhook` | Gateways | Marca `pagamento_confirmado=true` (custom_fields) → `field-changed` |
| `resend-webhook` | Resend | Eventos de e-mail |
| `tracking-event` / `tracking-pixel` | Pixel JS | Não toca pipeline; alimenta `tracking_*` |

## 4. Gatilhos manuais (UI / "ferramentas")

| Origem | Função alvo | Payload |
|---|---|---|
| `PipelineRuns.tsx` → "Forçar Pipeline V6" | `pipeline-run-executor` | `{ action:'create', scope:{ version:6 } }` |
| `PipelineRuns.tsx` → "Executar com escopo" | `pipeline-run-executor` | `{ only_agent: 'summarizer' \| 'typifier' \| 'maestro' }` |
| Admin → reset | `pipeline-run-executor` | `{ action:'reset_ai_classifications' }` |
| Kanban → "Destravar" | RPC `unlockLeadManually` | Limpa lock manual + tag `precisa_atencao_humana` |

## 5. Gaps encontrados (resumo)

| # | Severidade | Item | Ação |
|---|---|---|---|
| G1 | warn | 4 crons faltando em `DATABASE_LIVE.md §Crons` (`automations-tick`, `sequence-tick`, `agent_followups_tick`, `outreach-recovery-tick-daily`) | Patch nesta auditoria |
| G2 | warn | 11 triggers PG não listados em `DATABASE_LIVE.md §Triggers` (tabela §2.2) | Patch nesta auditoria |
| G3 | **crit** | UI envia `only_agent='parallel'` mas o dispatcher em `pipeline-run-executor/index.ts` só aceita `summarizer\|typifier\|maestro` (linhas 88, 229-231, 421-422). Clicar "Só Paralelos" hoje **não dispara `agendador` nem `movimentador`** isoladamente. | Registrado em `KNOWN_ISSUES.md` |
| G4 | info | `AUDIT_CHECKLIST.md` Q29 fala "8 jobs do pipeline" — número real é 9 (com `outreach-recovery`) | Patch |
| G5 | info | Não existe `docs/pipeline/runtime/USER_AUTOMATIONS.md` descrevendo regras de `public.automations` consumidas por `automations-tick` | Backlog F-DOC |

## 6. Como regenerar este snapshot

```sql
-- Crons
SELECT jobname, schedule FROM cron.job ORDER BY jobname;

-- Triggers públicos
SELECT c.relname AS table, tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
ORDER BY c.relname, tgname;
```

```bash
# Webhooks públicos
rg -nB1 "verify_jwt = false" supabase/config.toml
```

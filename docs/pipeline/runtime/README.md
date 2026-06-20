---
title: "Pipeline runtime — Clínica ÓR (estado real)"
topic: kanban
kind: map
audience: agent
updated: 2026-06-20
summary: "Hub da documentação de runtime do pipeline da Clínica ÓR. Reflete o que está deployado e ligado HOJE (2026-06-20, classifier V6 de 5 agentes), não o plano v4.2. Use esta pasta para auditar o sistema sem abrir código nem banco."
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/functions/pipeline-deterministic/
  - supabase/functions/pipeline-position-auditor/
  - supabase/functions/pipeline-post-move-verifier/
  - supabase/functions/pipeline-summarize/
  - supabase/functions/pipeline-payment-webhook/
  - supabase/functions/pipeline-run-executor/
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/_shared/pipeline-summarize-core.ts
  - supabase/functions/_shared/pipeline-tasks.ts
  - supabase/functions/_shared/pipeline-fase4.ts
  - supabase/functions/_shared/stage-bindings.ts
  - supabase/functions/_shared/pipeline-allowlist.ts
  - src/lib/manual-stage-move.ts
  - src/pages/Kanban.tsx
related_docs:
  - docs/pipeline/runtime/ARCHITECTURE.md
  - docs/pipeline/runtime/STAGES_LIVE.md
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/runtime/AUDITORS.md
  - docs/pipeline/runtime/SUMMARIZER.md
  - docs/pipeline/runtime/HUMAN_REACTOR.md
  - docs/pipeline/runtime/FIELDS_LIVE.md
  - docs/pipeline/runtime/TAGS_LIVE.md
  - docs/pipeline/runtime/DATABASE_LIVE.md
  - docs/pipeline/runtime/EVENTS_TELEMETRY.md
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
  - docs/pipeline/runtime/AUDIT_CHECKLIST.md
  - docs/pipeline/README.md
---

# Pipeline Clínica ÓR — runtime (2026-06-18)

> **Esta pasta é o espelho do código deployado**, não do roadmap. Quando o `docs/pipeline/` (raiz) descreve algo da v4.2 que ainda não foi implementado, é este `runtime/` que prevalece para auditoria.

## Identificadores

| Item | Valor |
|---|---|
| Clínica | `cf038458-457d-4c1a-9ac4-c88c3c8353a1` ("Clínica ÓR") |
| Pipeline default | `17c27f4d-8256-4ea7-b5b9-ed706494f686` |
| Allowlist | habilitada (ver `pipeline_automation_allowlist`) |
| Whatsapp agent | `ai-auto-reply` (independente do pipeline; só dispara `needs_ai_review`) |

## Mapa de componentes (status atual)

| Componente | Arquivo | Dispara via | Toggle principal (`app_settings`) | Status |
|---|---|---|---|---|
| **Regras determinísticas** (`auto:novo-lead`, `auto:secretary-replied`, `auto:appointment-sync`, `auto:field-changed`, inatividade, reativação, reator humano) | `pipeline-deterministic/index.ts` | Triggers PG + cron pg_net | 17 toggles individuais — todos `true` hoje | ✅ Ativo |
| **Classifier LLM V6** (5 agentes: `gpt-4o` Resumidor + 3× `gpt-5-mini` paralelos + `gpt-5` Maestro) | `pipeline-classify/index.ts` → `agent-core.ts` | Cron `pipeline-classify-tick` (1/min) + executor manual + smoke `{action:'lead'}` | `automation.classifier.enabled` = true | ✅ Ativo |
| **A1 Position Auditor** | `pipeline-position-auditor/index.ts` | Cron diário 03:00 BRT (`pipeline-position-auditor-daily`) | `automation.position_auditor.enabled` = true | ✅ Ativo |
| **A2 Post-Move Verifier** | `pipeline-post-move-verifier/index.ts` | Hook async dentro de `pipelineMove()` em moves `auto:*` | `automation.post_move_verifier.enabled` = true; whitelist em `automation.post_move_verifier.rules_enabled` = `[]` (= todas) | ✅ Ativo |
| **Summarizer** | `_shared/pipeline-summarize-core.ts` (chamado pelo classifier) + `pipeline-summarize` (entry standalone) | Acoplado ao classifier; `force` em intents não triviais | `automation.summarizer.enabled` = true | ✅ Ativo |
| **Reator humano** (tasks "Revisar lead travado") | `pipeline-deterministic/index.ts` → `ruleHumanReactorTick` | Cron diário 08:00 UTC (`pipeline-human-reactor-tick`) | `automation.human_reactor.enabled` = true | ✅ Ativo |
| **Lock manual / Destravar** | `src/lib/manual-stage-move.ts` + `src/pages/Kanban.tsx::LockManualChip` | UI Kanban | n/a (controle por usuário) | ✅ Ativo |
| **Tarefas auto** (NF, pagamento alegado, judicialização, renovação, objeção) | `_shared/pipeline-tasks.ts` + `_shared/pipeline-fase4.ts` | Disparado pelo classifier conforme `intent` | Toggles por regra | ✅ Ativos |
| **Stage bindings → sequences** | `_shared/stage-bindings.ts` | Hook async dentro de `pipelineMove()` | `automation.stage_bindings.enabled` = true | ✅ Ativo |
| **Pagamento (webhook real)** | `pipeline-payment-webhook/index.ts` | HTTP externo c/ service_role | `automation.payment_confirmed.enabled` = true | ⚠️ Endpoint pronto, sem provedor integrado |
| **Run executor manual** (admin) | `pipeline-run-executor/index.ts` | UI `/admin/pipeline-automations` | RLS clinic_admin + allowlist | ✅ Ativo |
| **Evals** | `pipeline-evals-run/index.ts` | Manual | n/a | ✅ Existe |

## Comandos rápidos para auditar

| Pergunta | Onde ver |
|---|---|
| Quais regras estão ligadas? | `SELECT key, value FROM app_settings WHERE key LIKE 'automation.%' ORDER BY key;` |
| Stages e ordem reais | `SELECT name, position, is_terminal, lock_auto_move FROM pipeline_stages WHERE pipeline_id='17c27f4d-…' ORDER BY position;` |
| Custom fields da clínica | `SELECT field_key, field_type, options FROM lead_custom_fields WHERE clinic_id='cf038458-…';` |
| Tags em uso | `SELECT unnest(tags) tag, count(*) FROM leads WHERE clinic_id='cf038458-…' GROUP BY tag ORDER BY 2 DESC;` |
| Últimas classificações | `SELECT created_at, payload FROM lead_events WHERE type='auto:classifier' ORDER BY created_at DESC LIMIT 20;` |
| Crons ativos | `SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;` |
| Auditor A1 — discordâncias | `SELECT created_at, payload FROM lead_events WHERE type='position_audit_disagreement' ORDER BY created_at DESC;` |
| Auditor A2 — warnings | `SELECT created_at, payload FROM lead_events WHERE type='post_move_disagreement' ORDER BY created_at DESC;` |

## Como ler esta pasta

1. **Visão geral** → este README.
2. **Arquitetura end-to-end** → `ARCHITECTURE.md`.
3. **O que cada componente faz** → arquivos individuais (`CLASSIFIER.md`, `AUDITORS.md`, etc.).
4. **Dados reais** (stages/tags/fields/events) → `STAGES_LIVE.md`, `TAGS_LIVE.md`, `FIELDS_LIVE.md`, `EVENTS_TELEMETRY.md`.
5. **Para auditar de fato** → `AUDIT_CHECKLIST.md` (30 perguntas com link para a resposta).
6. **Bugs conhecidos** → `KNOWN_ISSUES.md`.

## Relação com `docs/pipeline/` (planejamento)

| Doc planejamento | Doc runtime correspondente |
|---|---|
| `STAGES.md` | `STAGES_LIVE.md` |
| `SCENARIOS.md` | `DETERMINISTIC_RULES.md` + `HUMAN_REACTOR.md` |
| `DATABASE.md` | `DATABASE_LIVE.md` |
| `CUSTOM_FIELDS_E_TAGS.md` | `FIELDS_LIVE.md` + `TAGS_LIVE.md` |
| `AUTOMATION_PLAN.md` (gates G1–G11) | `GATES.md` |
| `AUTOMATION_PLAN.md` (fases) | implementado em parte — ver tabela acima |

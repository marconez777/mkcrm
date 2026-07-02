---
title: "Mapa: Pipeline Runtime (V6, 5 agentes)"
topic: kanban
kind: map
audience: agent
updated: 2026-07-01
summary: "Mapa consolidado do runtime do pipeline: 11 edge functions pipeline-*, 3 shared libs (pipeline-move, pipeline-tasks, pipeline-summarize-core), classifier V6 de 5 agentes (Resumidor → Agendador ∥ Tipificador ∥ Movimentador → Maestro), regras determinísticas auto:*, gates G1–G11, executor manual, auto-retry, auditores A1/A2, telemetria e feature flags. Ponto de entrada da Fase 3 do F-DOC-FULL — os detalhes vivem em docs/pipeline/runtime/*."
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/functions/pipeline-deterministic/
  - supabase/functions/pipeline-run-executor/
  - supabase/functions/pipeline-auto-retry/
  - supabase/functions/pipeline-summarize/
  - supabase/functions/pipeline-position-auditor/
  - supabase/functions/pipeline-post-move-verifier/
  - supabase/functions/pipeline-monthly-cycle-or/
  - supabase/functions/pipeline-payment-webhook/
  - supabase/functions/pipeline-queue-alert/
  - supabase/functions/pipeline-evals-run/
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/_shared/pipeline-tasks.ts
  - supabase/functions/_shared/pipeline-summarize-core.ts
  - supabase/functions/_shared/pipeline-fase4.ts
  - supabase/functions/_shared/pipeline-allowlist.ts
  - supabase/functions/_shared/ai-pipeline-filter.ts
  - supabase/functions/_shared/stage-bindings.ts
  - supabase/functions/_shared/agent-flags.ts
  - supabase/functions/_shared/metrics.ts
related_docs:
  - docs/pipeline/runtime/README.md
  - docs/pipeline/runtime/ARCHITECTURE.md
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/AUDITORS.md
  - docs/pipeline/runtime/FLOW_MATRIX.md
  - docs/pipeline/runtime/TRIGGERS_AUDIT.md
  - docs/pipeline/runtime/EVENTS_TELEMETRY.md
  - docs/pipeline/runtime/STAGES_LIVE.md
  - docs/pipeline/runtime/TAGS_LIVE.md
  - docs/pipeline/runtime/FIELDS_LIVE.md
  - docs/pipeline/runtime/DATABASE_LIVE.md
  - docs/pipeline/runtime/HUMAN_REACTOR.md
  - docs/pipeline/runtime/SUMMARIZER.md
  - docs/pipeline/runtime/USER_AUTOMATIONS.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
  - docs/maps/INBOX_KANBAN_LEADS.md
---

# Pipeline Runtime — Mapa

Este documento é o **hub navegacional da Fase 3**. Ele consolida o inventário verificado linha-a-linha de todas as edge functions `pipeline-*` e libs `_shared/pipeline-*.ts`, e delega o detalhamento profundo para os arquivos existentes em `docs/pipeline/runtime/`. Todo conteúdo aqui foi cruzado com o código real em 2026-07-01.

## 1. Inventário de edge functions

| Edge function | LOC | Papel | Disparado por | Doc detalhada |
|---|---:|---|---|---|
| `pipeline-classify` | 336 | Dispatcher V1/V2 (`automation.classifier.version`). V2 = classifier V6 de 5 agentes. Actions: `tick` (cron 60s) + `lead` (smoke/manual, aceita `only_agent`+`force`). Advisory lock `try_classify_lock` por lead. Backoff escalonado 2/5/30 min via `ai_review_fail_count`. | `pg_cron` (60s), `pipeline-run-executor` (fetch), Kanban "Rodar IA agora", webhook `evolution.ts` (setando `needs_ai_review=true`) | `runtime/CLASSIFIER.md` |
| `pipeline-classify/index.v1.ts` | — | Fallback determinístico (V1) mantido para rollback via feature flag. | idem `pipeline-classify` quando `version=v1` | `runtime/CLASSIFIER.md` §V1 |
| `pipeline-deterministic` | 1017 | Roteador único das regras `auto:*`. 9 actions: `novo-lead`, `secretary-replied`, `reactivation-inbound`, `appointment-sync`, `field-changed`, `inactivity-tick`, `reactivation-tick`, `human-reactor-tick`, `monthly-sweep-tick`. Todas passam por `pipelineMove()`. | Triggers PG via `pg_net` (lead/message/appointment INSERT, `leads.custom_fields` UPDATE) + `pg_cron` (inactivity/reactivation/human-reactor/monthly-sweep) | `runtime/DETERMINISTIC_RULES.md` |
| `pipeline-run-executor` | 660 | Executor **manual** de reprocessamento em lote. Chunk = 1 lead/invocação (auto-resume via fetch fire-and-forget). Timeout `callClassify` = 120s. Watchdog `STALE_AFTER_MS=6min` marca runs sem heartbeat como `error:worker_timeout_no_heartbeat`. Actions: `start`, `resume`, `status`, `cancel`, `comment`, `retry_commented`, `retry_errors`, `reset_ai_classifications`. | UI `/pipeline-runs` (`src/pages/PipelineRuns.tsx`) + `PipelineErrorsCard` (`src/components/admin/PipelineErrorsCard.tsx`) + self-resume | `runtime/CLASSIFIER.md` §Executor |
| `pipeline-auto-retry` | 146 | Cron 1min. Re-enfileira `pipeline_run_items` com `auto_retry_pending=true` (≤2 tentativas, backoff 30s→2min). Agrupa por `clinic_id`, cria novo run com `scope.lead_ids`, respeita `pipeline_provider_health` (skip se ambos providers bloqueados). | `pg_cron` | `runtime/CLASSIFIER.md` §Auto-retry + `runtime/KNOWN_ISSUES.md` |
| `pipeline-summarize` | 46 | Wrapper HTTP fino sobre `runSummarize()` de `_shared/pipeline-summarize-core.ts`. Chamado pelo classifier ao final de intents não triviais (força atualização de `leads.ai_summary` ≤800 chars). | `pipeline-classify` (apply.ts), manual smoke | `runtime/SUMMARIZER.md` |
| `pipeline-position-auditor` (A1) | 348 | Cron diário. Revisa leads parados ≥7 dias no stage. **Nunca move card** — apenas cria `lead_tasks` + tag `precisa_atencao_humana` + `lead_events`. | `pg_cron` diário | `runtime/AUDITORS.md` §A1 |
| `pipeline-post-move-verifier` (A2) | 194 | Hook async pós-move `auto:*`. Verifica coerência (stage vs custom_fields vs appointments). Só sinaliza. | `pipelineMove()` (fire-and-forget quando `source` começa com `auto:`) | `runtime/AUDITORS.md` §A2 |
| `pipeline-monthly-cycle-or` | 72 | Cron dia 1 do mês (Clínica ÓR). Move leads em `1ª Sessão Finalizada` sem retorno para `Nutrição Antigos`. | `pg_cron` mensal | `runtime/DETERMINISTIC_RULES.md` §monthly-sweep |
| `pipeline-payment-webhook` | 89 | Webhook público (Eduzz/Stripe). Ao receber `payment_approved` para lead, move para `Tratamento agendado` via `pipelineMove` com `source=system:payment`. | HTTP externo | `runtime/DETERMINISTIC_RULES.md` §payment |
| `pipeline-queue-alert` | 120 | Cron 5min. Se fila `needs_ai_review` > threshold ou `pipeline_provider_health.blocked_until` > now, cria `alerts` + notifica Slack/email admin. | `pg_cron` | `runtime/KNOWN_ISSUES.md` §Quota Guard |
| `pipeline-evals-run` | 104 | Roda evals de regressão do classifier contra fixtures salvos em `ai_evals_cases`. Usado em CI e sob demanda. | Manual | `runtime/CLASSIFIER.md` §Evals |

Total: **11 edge functions**, **~3.632 LOC**.

## 2. Shared libs (`_shared/pipeline-*.ts` + auxiliares)

| Arquivo | LOC | Responsabilidade |
|---|---:|---|
| `pipeline-move.ts` | 332 | Helper único de move. Aplica gates G3 (toggle), G4 (idempotência via `lead_events`), G2 (`lock_auto_move`), D3 (Paciente antigo lock), G8 (nunca escreve `pipeline_id`), G5 (grava `lead_stage_history.source`). Dispara A2 async. |
| `pipeline-tasks.ts` | 179 | Criação idempotente de `lead_tasks` (dedup por `dedup_key`). Usado por A1, deterministic rules, classifier. |
| `pipeline-summarize-core.ts` | 132 | Lógica de `runSummarize()` — chama Gemini/OpenAI, atualiza `leads.ai_summary`, respeita 800 chars. |
| `pipeline-fase4.ts` | 142 | Regras da Fase 4 v4.2 (custom fields writers automáticos: `Teleconsulta?`, `Modalidade`, etc.). |
| `pipeline-allowlist.ts` | 35 | `isClinicPipelineAllowed()` — checa `pipeline_automation_allowlist.enabled`, cache 30s. |
| `ai-pipeline-filter.ts` | 56 | `isAiAllowedForPipeline()` — checa se o pipeline está na lista `clinics.settings.ai_target_pipeline_ids`. |
| `stage-bindings.ts` | 71 | `stage_sequence_bindings` — mapeia stage → sequência de mensagens auto-disparada ao entrar. **Dormente** (ver KNOWN_ISSUES). |
| `agent-flags.ts` | 29 | Lê `ai_agents.silent` — usado por auto-reply para não responder em pipelines silenciosos. |
| `metrics.ts` | 77 | Padroniza gravação em `ai_usage` (tokens, custo, latência, agent, model, provider). |

## 3. Classifier V6 — 5 agentes em linha de montagem

Documentado em detalhes em `runtime/CLASSIFIER.md`. Resumo:

```text
Resumidor  ─┐
            │
Agendador ──┼──►  Maestro  ──► apply.ts ──► pipelineMove + patch custom_fields + tags
Tipificador┤
Movimentador┘
```

- **Provider default**: Lovable AI Gateway (`google/gemini-2.5-flash` no Resumidor/Maestro, `gemini-2.5-flash-lite` nos paralelos).
- **Fallback BYOK OpenAI**: ativado via `CLASSIFIER_PROVIDER=openai` (rollback) ou automaticamente quando Gemini retorna quota/timeout (ver `_shared/classifier-ai.ts:isTransientAgentError`).
- **Structured output**: cada agente valida contra `pipeline-classify/schema.ts` (AI SDK v5 structured outputs — Fase A).
- **Parser de datas**: `date-parser.ts` determinístico (nunca depende da LLM para parse de "amanhã 14h").
- **Guard "Paciente antigo"**: `rules/first-consult.ts` bloqueia mudança de stage se paciente já tem `consulta_finalizada_em`.
- **Watermark**: `leads.last_processed_message_id_classifier` evita reprocessar mensagens já vistas (bypass via `force=true`).
- **Telemetria por agente**: `ai_usage` + `lead_events.payload.agents` — modelos, tokens, latência, `ran[]`.

## 4. Regras determinísticas (`pipeline-deterministic`)

Detalhes em `runtime/DETERMINISTIC_RULES.md`. Mapa condensado:

| Action | Trigger | Move destino | Toggle |
|---|---|---|---|
| `novo-lead` | Trigger PG lead INSERT | `Novo` | `automation.novo_lead.enabled` |
| `secretary-replied` | Trigger PG message INSERT (outbound) | (só marca `precisa_atencao_humana` off) | `automation.secretary_replied.enabled` |
| `reactivation-inbound` | Trigger PG message INSERT (inbound em `Sem resposta`/`Nutrição*`) | `Qualificação` | `automation.reactivation.enabled` |
| `appointment-sync` | Trigger PG appointment INSERT/UPDATE | `Consulta agendada` / `Tratamento agendado` / `Consulta finalizada` conforme `kind`+`status` | `automation.appointment_sync.enabled` |
| `field-changed` | Trigger PG `leads.custom_fields` UPDATE | Depende (ciclo-concluido → `Paciente antigo`; modality-guard corrige) | `automation.field_changed.enabled` |
| `inactivity-tick` | Cron | 24h → `precisa_atencao_humana`; 3d → `Sem resposta`; 7d → task A1; 60d → `Nutrição inativa` | `automation.inactivity.enabled` |
| `reactivation-tick` | Cron | Envia sequência de reativação para `Nutrição inativa` | `automation.reactivation_tick.enabled` |
| `human-reactor-tick` | Cron diário | Cria task se lead com `precisa_atencao_humana` parado ≥7d | `automation.human_reactor.enabled` |
| `monthly-sweep-tick` | Cron dia 1 | `1ª Sessão Finalizada` sem retorno → `Nutrição Antigos` | `automation.monthly_sweep.enabled` |

## 5. Gates de segurança (G1–G11)

Aplicados centralmente em `_shared/pipeline-move.ts`. Detalhamento em `runtime/GATES.md`.

| Gate | Onde | O que garante |
|---|---|---|
| G1 (removido) | `pipeline-move.ts` | `manual_lock_until` — descontinuado no PR4. Substituído por G11. |
| G2 | `pipeline-move.ts` (pré-INSERT) | `pipeline_stages.lock_auto_move` no destino impede `source=auto:*`. |
| G3 | `pipeline-move.ts` (pré-INSERT) | Toggle em `app_settings` — default OFF (fail-safe). |
| G4 | `pipeline-move.ts` (`lead_events` idempotencyKey) | Idempotência por evento. |
| G5 | `pipeline-move.ts` (INSERT history) | `lead_stage_history.source` sempre preenchido. |
| G8 | `pipeline-move.ts` (UPDATE) | Nunca escreve `pipeline_id` — trigger `sync_lead_pipeline_id` deriva. |
| G10 | Trigger PG + RPC `apply_lead_automation_patch` | Cleanup atômico do patch aplicado pelo classifier. |
| G11 | `pipeline-classify/apply.ts` + auditores | Auditores **nunca movem** — só sinalizam via tag/task/event. |
| D3 | `pipeline-move.ts` | Stage atual = "Paciente antigo" + `source=auto:*` → aborta. |

## 6. Executor manual (`pipeline-run-executor`)

Modelo de execução chunked para não estourar o limite de 150s da runtime:

1. UI cria `pipeline_run` com `scope={pipeline_id?, stage_ids?, lead_ids?, top_n?, only_agent?}`.
2. Cada invocação processa **1 lead** (`CHUNK_SIZE=1`, pipeline V6 pode passar 3min).
3. Heartbeat a cada 30s durante a chamada de `pipeline-classify`.
4. Ao fim do chunk, se ainda houver leads, dispara `resume` via `fetch` fire-and-forget e encerra.
5. Watchdog: run sem heartbeat há >6min → `status=error, totals.error_reason=worker_timeout_no_heartbeat`.

Actions expostas: `start` / `resume` / `status` / `cancel` / `comment` / `retry_commented` / `retry_errors` / `reset_ai_classifications`.

Gates de autorização:
- `assertClinicAdmin()`: super_admin OU `clinic_members.role in (owner, admin)`.
- `assertAllowlisted()`: `pipeline_automation_allowlist.enabled=true`.

## 7. Auditores A1/A2

| Auditor | Tipo | Regra | Ação (nunca move) |
|---|---|---|---|
| A1 `pipeline-position-auditor` | Cron diário | Lead parado ≥7d no stage | Cria `lead_tasks` + tag `precisa_atencao_humana` + `lead_events(type=auditor_a1_flag)` |
| A2 `pipeline-post-move-verifier` | Hook async pós-move `auto:*` | Verifica coerência stage ↔ custom_fields ↔ appointments | `lead_events(type=auditor_a2_flag)` + task quando divergência forte |

## 8. Triggers, crons e webhooks (visão completa)

Snapshot vivo em `runtime/TRIGGERS_AUDIT.md`. Categorias:

- **Triggers PG** (via `pg_net`): `on_lead_insert`, `on_message_insert`, `on_appointment_change`, `on_lead_custom_fields_update`, `sync_lead_pipeline_id` (deriva `pipeline_id` a partir de `stage_id`), `apply_lead_automation_patch` (G10 cleanup).
- **pg_cron**: `pipeline-classify tick` (60s), `pipeline-auto-retry` (1min), `pipeline-queue-alert` (5min), `inactivity-tick` (30min), `reactivation-tick` (1h), `human-reactor-tick` (diário), `pipeline-position-auditor` (diário), `pipeline-monthly-cycle-or` (dia 1 do mês), `pipeline-payment-webhook` recon (opcional).
- **Webhooks públicos**: `pipeline-payment-webhook` (Eduzz/Stripe), `evolution.ts` (WhatsApp inbound que seta `needs_ai_review=true`).
- **UI manual**: `/pipeline-runs`, `PipelineErrorsCard`, botão "Rodar IA agora" no Kanban/Drawer, `AdminPipelineAutomations` (toggles).

## 9. Feature flags críticas (`app_settings`)

Painel em `src/pages/admin/AdminPipelineAutomations.tsx`. Chaves:

- `automation.classifier.enabled` (Fase 2) — liga/desliga cron do classifier.
- `automation.classifier.version` — `v1` | `v2` (default `v2`).
- `automation.classifier.history_tool_enabled` — tool call que lê histórico do lead.
- `automation.summarizer.enabled` (Fase 3).
- `automation.novo_lead.enabled` / `automation.secretary_replied.enabled` / `automation.reactivation.enabled` / `automation.appointment_sync.enabled` / `automation.field_changed.enabled` / `automation.inactivity.enabled` / `automation.human_reactor.enabled` / `automation.monthly_sweep.enabled`.
- Whitelist dinâmica de tags: `pipeline.tag_whitelist` (44 tags pós Fase A/P7).

Filtro por pipeline: `clinics.settings.ai_target_pipeline_ids` (via `AIPipelinesCard`).
Allowlist por clínica: `pipeline_automation_allowlist.enabled`.

## 10. Fluxo end-to-end do lead

Consulte a **FLOW_MATRIX** (`runtime/FLOW_MATRIX.md`) para a tabela `cenário → trigger → executor → ação → stage destino → toggle`. Visão simplificada:

```text
WhatsApp inbound
      │
      ▼
 evolution.ts (webhook) ──► leads.needs_ai_review=true
      │
      ├─► trigger PG novo-lead ──► pipeline-deterministic (auto:novo-lead) ──► "Novo"
      │
      ▼
 cron pipeline-classify tick (60s) ──► classifyOneV2
      │  (advisory lock, loadLeadContext, watermark)
      ▼
 Classifier V6 (5 agentes) ──► apply.ts
      │  ├─► pipelineMove (gates G2/G3/G4/G5/G8/D3)
      │  ├─► patchCustomFields (via RPC atômica — G10)
      │  ├─► addTags/removeTags (whitelist v4.2)
      │  ├─► lead_tasks (dedup)
      │  └─► lead_events (telemetria por agente)
      │
      ├─► pipelineMove dispara A2 async ──► post-move-verifier
      │
      └─► runSummarize() ──► leads.ai_summary (≤800 chars)

Paralelo/independente:
- pg_cron auto-retry ──► reprocessa items com erro transitório
- pg_cron A1 diário ──► sinaliza leads parados
- pg_cron inactivity/reactivation/monthly-sweep ──► pipeline-deterministic
- UI executor ──► pipeline-run-executor ──► chunked resume ──► pipeline-classify
```

## 11. Telemetria & observabilidade

Detalhes em `runtime/EVENTS_TELEMETRY.md` + `runtime/DATABASE_LIVE.md`.

- `lead_events` — 30+ tipos catalogados. Novos: `agents_*` (V6), `auditor_a1_flag`, `auditor_a2_flag`, `pipeline_move_attempted`.
- `lead_stage_history.source` — enum: `manual`, `ui`, `auto:*`, `reator:*`, `system:*`.
- `pipeline_runs` / `pipeline_run_items` — histórico de execuções manuais + auto-retry. Campos-chave: `status`, `last_heartbeat_at`, `totals`, `scope`, `auto_retry_count/pending`.
- `ai_usage` — 1 linha por agente por run (provider, model, prompt/completion tokens, cost_usd, latency_ms).
- `pipeline_provider_health` — cache de `blocked_until` por (clinic, provider) para skip preventivo.
- `error_events` (surface = `pipeline`) — erros críticos persistidos para o `PipelineErrorsCard`.

RPC de paginação: `admin_pipeline_errors_paginated` (dedup por lead_id).

## 12. Superfície frontend

| Rota / componente | Papel |
|---|---|
| `/pipeline-runs` (`src/pages/PipelineRuns.tsx`) | Lista runs, cria novo run (escopo por pipeline/stage/leads/only_agent), acompanha progresso via realtime `pipeline_runs`. |
| `AdminPipelineAutomations` (`src/pages/admin/AdminPipelineAutomations.tsx`) | Toggles de todas as flags `automation.*`. |
| `PipelineErrorsCard` (`src/components/admin/PipelineErrorsCard.tsx`) | Grid paginado de leads com erro; ações: retry individual, retry all. |
| `AutoRetryRecoveryCard` (`src/components/admin/AutoRetryRecoveryCard.tsx`) | Métrica de sucesso do cron auto-retry. |
| `AIPipelinesCard` (`src/components/settings/AIPipelinesCard.tsx`) | Escolhe em quais pipelines o classifier atua (`ai_target_pipeline_ids`). |
| Kanban / LeadDrawer | Botão "Rodar IA agora" invoca `pipeline-classify` com `force=true`. |
| `src/lib/pipeline-skip-reasons.ts` | Mapa `skip_reason → texto humano` para UI (23 motivos mapeados). |

## 13. Invariantes (não quebrar)

1. **Nenhuma edge escreve `leads.pipeline_id` diretamente** — sempre via trigger `sync_lead_pipeline_id` derivado de `stage_id`. Quebrar isso destrói o G8.
2. **Todo move de card passa por `pipelineMove()`** — copiar/colar UPDATE em `stage_id` fora do helper burla G2/G3/G4/G5/D3.
3. **Auditores A1/A2 nunca movem card** — G11. Só criam `lead_events`, tags e tasks.
4. **`only_agent` é para debug** — nunca chamar em produção sem `force`, pois pula watermark update em `mode=partial`.
5. **`CHUNK_SIZE=1` no executor** é intencional — pipeline V6 pode ultrapassar 3min por lead. Aumentar quebra o watchdog.
6. **Advisory lock `try_classify_lock`** protege contra dupla execução; nunca contornar.
7. **Feature flags default OFF** — G3 é fail-safe. Migration nova de regra `auto:*` deve inserir toggle explicitamente.
8. **Watermark `last_processed_message_id_classifier`** só avança em `mode=full`. Não avançar em partial é intencional.
9. **`isTransientAgentError` decide throw vs skip** — throw mantém `needs_ai_review=true` para retry; skip limpa a fila.
10. **Whitelist de tags v4.2** — classifier só aplica tags de `pipeline.tag_whitelist`. Adicionar tag nova exige migration em `app_settings`.
11. **`pipeline_automation_allowlist`** por clínica é obrigatório — sem enable = classifier + executor pulam a clínica inteira.

## 14. Bugs conhecidos & débitos técnicos

Consulte `runtime/KNOWN_ISSUES.md` e `runtime/plan-correcoes.md`. Destaques ativos:

- `stage_sequence_bindings` **dormente** — infra existe mas nada consome (não dispara sequência ao entrar no stage).
- `pipeline-deterministic/index.ts` tem 1017 LOC — candidato a split por regra.
- V1 do classifier mantido só como rollback; pode ser removido após 30d estável.
- Falta doc de `pipeline-evals-run` além de menção no CLASSIFIER.
- `pipeline-monthly-cycle-or` é hardcoded para Clínica ÓR (nome no arquivo) — deveria ser genérico via config.

## 15. Docs detalhadas em `docs/pipeline/runtime/` (20 arquivos)

Todas verificadas nesta fase (datas de update entre 2026-06-18 e 2026-06-23, cross-checadas com código real em 2026-07-01):

- `README.md` — hub da pasta.
- `ARCHITECTURE.md` — diagrama end-to-end.
- `CLASSIFIER.md` — V6 5 agentes, provider, telemetria.
- `DETERMINISTIC_RULES.md` — cada regra `auto:*`.
- `GATES.md` — G1–G11 mapeados no código.
- `AUDITORS.md` — A1 + A2.
- `HUMAN_REACTOR.md` — lock manual (descontinuado no PR4) + reator.
- `FLOW_MATRIX.md` — matriz cenário → ação.
- `TRIGGERS_AUDIT.md` — snapshot de crons/triggers/webhooks.
- `EVENTS_TELEMETRY.md` — catálogo de eventos.
- `STAGES_LIVE.md` — 12 stages reais da Clínica ÓR.
- `TAGS_LIVE.md` — whitelist v4.2 dinâmica (44 tags).
- `FIELDS_LIVE.md` — 23 custom fields.
- `DATABASE_LIVE.md` — tabelas e triggers.
- `SUMMARIZER.md` — `runSummarize()`.
- `USER_AUTOMATIONS.md` — regras user-configuráveis (tabela `automations`).
- `KNOWN_ISSUES.md` — bugs abertos e resolvidos.
- `plan-correcoes.md` — plano de correções por ROI.
- `AUDIT_CHECKLIST.md` — 30 perguntas para outro agente auditar.
- `WEBHOOK_EVOLUTION.md` — race condition do webhook (23505).

---
name: Docs maintenance progress
description: Snapshot do que está documentado em docs/pipeline/runtime/ + estado da arquitetura do Classifier (V6 de 5 agentes) + Clínica ÓR fluxo novo (Fases 1-7, 2026-06-21)
type: feature
---

## Clínica ÓR — Fluxo novo completo (2026-06-21)

**Status: Fases 1-7 concluídas.** Doc canônica: `docs/estudo/clinica-or-fluxo-novo.md` (atualizada hoje com code_refs do report function + componente Tracking, cron correto, e seção Sequências).

| Fase | O que ficou no projeto |
|---|---|
| 1. Stages | Renomeadas "Em tratamento" → "1ª Sessão Finalizada" e "Nutrição inativa" → "Nutrição Inativa (Geladeira de Leads)" (ids mantidos). Nova stage "Nutrição Antigos (>60d)" pos 11. Somente pipeline `17c27f4d-...` / clinic `cf038458-...`. |
| 2. Tags/Segmentos | `pipeline_stages.auto_tag_on_enter` + trigger `apply_stage_auto_tags()` mescla tags em `leads.tags` no INSERT de `lead_stage_history`. 4 segmentos `is_system=true` em `email_segments` (`seg_nutricao_leds`, `seg_nutricao_antigos`, `seg_paciente_antigo`, `seg_relatorio_dia1`). |
| 3. Regras de inatividade | Branches no `automations-tick`/`pipeline-inactivity-tick`: Qualificação +24h IA#1, +48h IA#2, depois → Sem Resposta; Sem Resposta +7d → Geladeira; Paciente Antigo +60d sem inbound → Nutrição Antigos. Inbound em qualquer geladeira → Qualificação. |
| 4. Ciclo mensal | Edge function `pipeline-monthly-cycle-or` (cron dia 1) move leads de "1ª Sessão Finalizada" → "Paciente antigo". |
| 5. Sequências | 3 sequências `pipeline_enter` em `message_sequences` + bindings `on_enter`, **disabled**, aguardando copy: "ÓR — Nutrição Leads", "ÓR — Nutrição Antigos", "ÓR — Reativação Paciente Antigo". `stop_on_reply=true`. |
| 6. Relatório Dia 1 | Edge function `report-finalizados-mensal-or` (cron `0 6 1 * *`, job `report-finalizados-mensal-or-day1`) agrega Consulta Finalizada + 1ª Sessão Finalizada do mês anterior via `lead_stage_history`, upsert em `clinic_monthly_reports`, envia email com template `or-monthly-finalizados-report` para admin, renderiza card em `/tracking` via `src/components/tracking/MonthlyFinalizadosReportCard.tsx`. |
| 7. Docs | Esta memória + `docs/estudo/clinica-or-fluxo-novo.md` atualizadas. Sem `scripts/docs-sync.mjs` neste projeto. |

## Transição Agendamento 100% Humano (2026-06-24)

Aplicado em código + migration `app_settings`:
- `pipeline-classify/apply.ts`: constantes `HUMAN_SCHEDULING_FIELDS` / `HUMAN_SCHEDULING_STAGES`; datas de agendamento extraídas viram `fields_rejected` com `reason=ai_scheduling_disabled_by_human_transition`; general move recusa os 4 estágios proibidos.
- `pipeline-classify/agent-core.ts`: bloco "🚨 TRANSIÇÃO AGENDAMENTO HUMANO" injetado nos prompts do Movimentador e do Maestro.
- `pipeline-deterministic/index.ts`: `ruleFieldChanged` agora dispara `auto:field-changed-consulta` / `auto:field-changed-procedimento` quando a secretária preenche `consulta_agendada_em` / `procedimento_agendado_em` (toggle `automation.appointment_sync.enabled`). `ruleConsultaPassou` retorna cedo `{ skipped: "disabled_by_human_transition" }`.
- `pipeline-position-auditor/index.ts`: prompt do A1 proibido de sugerir os 4 estágios e de questionar a agenda.
- Migration: `automation.appointment_sync.enabled=true`, `automation.consulta_passou_finaliza.enabled=false`.
- Docs: `docs/pipeline/runtime/DETERMINISTIC_RULES.md` + `KNOWN_ISSUES.md` ganharam seção.

---

## docs/pipeline/runtime/ — atualizado 2026-06-21

Espelho do código deployado. Todos os arquivos refletem o **Classifier V6 de 5 agentes** (Resumidor → [Agendador ∥ Tipificador ∥ Movimentador] → Maestro).

**Auditoria de gatilhos (2026-06-21)** em `docs/pipeline/runtime/TRIGGERS_AUDIT.md` — snapshot vivo de `cron.job` (29 jobs), `pg_trigger` (~80) e webhooks públicos. `DATABASE_LIVE.md` ganhou §Triggers expandida (11 triggers a mais) e §Crons com `outreach-recovery-tick-daily`. `KNOWN_ISSUES.md -3` registra que `only_agent='parallel'` ainda não é aceito pelo dispatcher (`pipeline-run-executor/index.ts:88,229,421`). `AUDIT_CHECKLIST.md` Q29 atualizado para 9 jobs.


## Pipeline V6 — DEPLOYADO (2026-06-20)

Mudanças aplicadas:

1. **Classifier multi-step V6** (`supabase/functions/pipeline-classify/agent-core.ts`): linha de montagem com 5 agentes em 3 fases:
   - Fase 1 (serial): Resumidor — `gpt-4o`, fallback `gpt-5-mini`.
   - Fase 2 (paralela, `Promise.all`): Agendador, Tipificador, Movimentador — 3× `gpt-5-mini`.
   - Fase 3 (serial): Maestro — `gpt-5`. Recebe summary + 3 outputs paralelos, decide intent/stage/confidence.
2. **Telemetria individual por agente**: `recordStep()` grava 5 linhas em `ai_usage` por execução com operations exatas: `classifier:summarizer`, `classifier:agendador`, `classifier:typifier`, `classifier:movimentador`, `classifier:maestro`.
3. **Payload `auto:classifier`** (`pipeline-classify/index.ts:133` → `version: 3`) traz bloco `agents` com modelo + latência + flag `ran` por agente. UI tolera V2/V5 antigos.
4. **UI atualizada**: `src/components/ai/usage/PipelineOverview.tsx` e `src/pages/PipelineRuns.tsx` mostram layout Resumidor → "Execução Paralela" (3 cards) → Maestro. Modo `parallel` ainda **não** implementado no dispatcher.

## Estado anterior (histórico, não mais atual)

### Fase 1 V5 — DEPLOYADA 2026-06-19

1. MCP/Automations refatoradas usando `pipelineMove` com toggles `automation.ai_chat_move.enabled` e `automation.ui_rule_move.enabled`.
2. Wipe centralizado de chips no `_shared/pipeline-move.ts` antes do UPDATE de stage.
3. Guard D3 estreitado: exceção apenas para `toStage.name === "Nutrição inativa"`.
4. SLA 60d Paciente antigo: branch `tier60pa` em `ruleInactivityTick`.
5. Lock D3 no Classifier bloqueia move quando `stageName === "Paciente antigo"`.
6. "Desqualificado" aceito no Canon.

### Classifier V2 → V5 → V6

V2 era monolito gpt-5-mini single-call. V5 quebrou em 3 agentes sequenciais. V6 (atual) adiciona Agendador e Movimentador, paraleliza os 3 do meio e troca o Maestro para `gpt-5`. Apenas G10 + datas determinísticas + RPC `apply_lead_automation_patch` continuam idênticos desde V2.

Não há `scripts/docs-sync.mjs` neste projeto.

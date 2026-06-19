# Memory: docs/maintenance-progress
---
name: Docs maintenance progress
description: Snapshot do que está documentado em docs/pipeline/runtime/ + estado da refatoração do Classifier V2 (2026-06-18)
type: feature
---

## docs/pipeline/runtime/ — atualizado 2026-06-19

Espelho do código deployado. `GATES.md` e `CLASSIFIER.md` refletem Fase 1 V5 (2026-06-19).

## Fase 1 V5 — DEPLOYADA (2026-06-19)

Mudanças aplicadas ao código (+ docs atualizadas):

1. **MCP/Automations refatoradas** — `ai-chat/index.ts` (tool `move_lead_stage`) e `automations-tick/index.ts` (action `move_stage`) agora chamam `pipelineMove` (toggles `automation.ai_chat_move.enabled`, `automation.ui_rule_move.enabled`).
2. **Wipe centralizado** — `_shared/pipeline-move.ts` manipula `leads.custom_fields` JSONB antes do UPDATE: remove `interessado` ao sair de Qualificação; remove `consulta_agendada_em`/`procedimento_agendado_em`/`consulta_confirmada`/`procedimento_confirmado` e seta `aguardando=true` ao entrar em Consulta finalizada. NUNCA tocar em `lead_custom_fields` (schema).
3. **Guard D3 estreitado** — exceção apenas para `toStage.name === "Nutrição inativa"`.
4. **SLA 60d Paciente antigo** — branch `tier60pa` em `pipeline-deterministic/ruleInactivityTick` move leads inativos há 60+ dias para Nutrição inativa (toggle `automation.inactivity_paciente_antigo.enabled`).
5. **Lock D3 no Classifier** — `apply.ts:245-255` bloqueia tentativa de move se `ctx.stageName === "Paciente antigo"` (`reason: 'locked_in_paciente_antigo'`).
6. **Desqualificado no Canon** — `pipeline-classify/schema.ts` agora aceita stage "Desqualificado" sem cair no fallback "Qualificação".

## Classifier V2 — DEPLOYADO (2026-06-18)

`supabase/functions/pipeline-classify/` modular: dispatcher v1/v2, schema/context/agent-core/date-parser/apply, rules. 1 chamada gpt-5-mini. Datas determinísticas. G10 implementado via trigger PG + RPC + override de datas (`isDateFromParser` + `confidence ≥ 0.85`).

**Telemetria v2**: `lead_events.payload.version=2`.

**Cards strict-no-move**: Fase 1 V5 destravou General Move (Consulta agendada) — não mais acumulam em Qualificação.

Não há `scripts/docs-sync.mjs` neste projeto.

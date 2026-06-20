---
name: Docs maintenance progress
description: Snapshot do que está documentado em docs/pipeline/runtime/ + estado da arquitetura do Classifier (V6 de 5 agentes, 2026-06-20)
type: feature
---

## docs/pipeline/runtime/ — atualizado 2026-06-20

Espelho do código deployado. Todos os arquivos refletem o **Classifier V6 de 5 agentes** (Resumidor → [Agendador ∥ Tipificador ∥ Movimentador] → Maestro). `CLASSIFIER.md` reescrito; `ARCHITECTURE.md`, `EVENTS_TELEMETRY.md`, `README.md`, `GATES.md`, `KNOWN_ISSUES.md`, `SUMMARIZER.md` atualizados em 2026-06-20. `docs/pipeline/README.md` e `AUTOMATION_PLAN.md` ganharam nota apontando para runtime/.

## Pipeline V6 — DEPLOYADO (2026-06-20)

Mudanças aplicadas:

1. **Classifier multi-step V6** (`supabase/functions/pipeline-classify/agent-core.ts`): linha de montagem com 5 agentes em 3 fases:
   - Fase 1 (serial): Resumidor — `gpt-4o`, fallback `gpt-5-mini`.
   - Fase 2 (paralela, `Promise.all`): Agendador, Tipificador, Movimentador — 3× `gpt-5-mini`.
   - Fase 3 (serial): Maestro — `gpt-5`. Recebe summary + 3 outputs paralelos, decide intent/stage/confidence.
2. **Telemetria individual por agente**: `recordStep()` grava 5 linhas em `ai_usage` por execução com operations exatas: `classifier:summarizer`, `classifier:agendador`, `classifier:typifier`, `classifier:movimentador`, `classifier:maestro`. Resolveu o agrupamento incorreto que existia no refactor inicial dos paralelos.
3. **Payload `auto:classifier`** (`pipeline-classify/index.ts:133` → `version: 3`) traz bloco `agents` com modelo + latência + flag `ran` por agente. UI tolera V2/V5 antigos (sem bloco / só 3 agentes) renderizando "—" para os ausentes.
4. **UI atualizada**: `src/components/ai/usage/PipelineOverview.tsx` e `src/pages/PipelineRuns.tsx` mostram layout Resumidor → "Execução Paralela" (3 cards) → Maestro. Botão "Executar com escopo" hoje aceita `summarizer | typifier | maestro` (modo `parallel` ainda **não** implementado no dispatcher — `index.ts:188`). Caso a UI mande `parallel`/`agendador`/`movimentador`, o dispatcher hoje retorna 400.

## Estado anterior (histórico, não mais atual)

### Fase 1 V5 — DEPLOYADA 2026-06-19 (mantido por contexto)

1. MCP/Automations refatoradas (`ai-chat/index.ts` tool `move_lead_stage`, `automations-tick/index.ts` action `move_stage`) usando `pipelineMove` com toggles `automation.ai_chat_move.enabled` e `automation.ui_rule_move.enabled`.
2. Wipe centralizado de chips no `_shared/pipeline-move.ts` antes do UPDATE de stage (manipula `leads.custom_fields` JSONB, **nunca** `lead_custom_fields`).
3. Guard D3 estreitado: exceção apenas para `toStage.name === "Nutrição inativa"`.
4. SLA 60d Paciente antigo: branch `tier60pa` em `ruleInactivityTick` (toggle `automation.inactivity_paciente_antigo.enabled`).
5. Lock D3 no Classifier (`apply.ts:245-255`) bloqueia move quando `stageName === "Paciente antigo"`.
6. "Desqualificado" aceito no Canon (`schema.ts`).

### Classifier V2 → V5 → V6

V2 era monolito gpt-5-mini single-call. V5 quebrou em 3 agentes sequenciais (Resumidor/Tipificador/Maestro). V6 (atual) adiciona Agendador e Movimentador, paraleliza os 3 do meio e troca o Maestro para `gpt-5`. Apenas G10 + datas determinísticas + RPC `apply_lead_automation_patch` continuam idênticos desde V2.

Não há `scripts/docs-sync.mjs` neste projeto.

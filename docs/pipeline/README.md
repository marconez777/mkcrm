---
title: "Pipeline — Documentação para planejamento de automação"
topic: kanban
kind: map
audience: agent
updated: 2026-06-18
summary: "Hub da documentação do pipeline (Clínica ÓR). Estado atual 100% manual, mapa de stages, cenários canônicos do estudo, schema do banco e plano de automação."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/SCENARIOS.md
  - docs/pipeline/DATABASE.md
  - docs/pipeline/AUTOMATION_PLAN.md
  - docs/estudo-geral.md
---

# Pipeline — Documentação base para automação

Esta pasta consolida **tudo o que é preciso para planejar a automação do pipeline** sem precisar varrer o código a cada vez.

Contexto:
- O **agente de pipeline anterior foi removido** (extractor, vision-tick, field-rules, reclassify-deep). O pipeline hoje é **100% manual**.
- O **agente de WhatsApp (auto-reply)** continua ativo e independente — não está documentado aqui.
- A base empírica para decisões vem do estudo de 441 leads / 3.973 mensagens / 306 áudios da Clínica ÓR (ver `docs/estudo/`).

## Como usar esta pasta

| Quando você quiser… | Leia |
|---|---|
| Saber quais colunas existem hoje e o que cada uma significa | [`STAGES.md`](./STAGES.md) |
| Entender os cenários reais que aparecem nas conversas | [`SCENARIOS.md`](./SCENARIOS.md) |
| Saber em quais tabelas/colunas mexer ao automatizar | [`DATABASE.md`](./DATABASE.md) |
| Planejar **o que** automatizar e em qual ordem | [`AUTOMATION_PLAN.md`](./AUTOMATION_PLAN.md) |
| Ver evidência detalhada por coluna (transcrições, sínteses) | [`docs/estudo/`](../estudo/README.md) |

## Princípios para qualquer automação futura

1. **Tudo opt-in por stage.** Nenhuma automação deve rodar globalmente — sempre escopada a `pipeline_id` + `stage_id`.
2. **Sempre registrar em `lead_stage_history.source`** (ex: `'auto:rule-x'`) para auditoria e rollback.
3. **Respeitar `manual_lock_until` e `stage.lock_auto_move`** — se o humano mexeu, IA não mexe por X horas.
4. **Cada movimentação automática deve ter um motivo legível em `reason`** — nunca mover "porque sim".
5. **Idempotência**: rodar 2x a mesma regra no mesmo lead não deve duplicar tarefas/mensagens (usar `lead_events.type` + dedup window).

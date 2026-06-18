---
title: "Pipeline — Documentação para planejamento de automação"
topic: kanban
kind: map
audience: agent
updated: 2026-06-18
summary: "Hub da documentação do pipeline (Clínica ÓR). Estado atual 100% manual, mapa de stages, cenários canônicos do estudo, schema do banco, plano v3 e referência de custom_fields/tags."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/SCENARIOS.md
  - docs/pipeline/DATABASE.md
  - docs/pipeline/AUTOMATION_PLAN.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
  - docs/pipeline/LEAD_SAMPLES.md
  - docs/estudo-geral.md
---

# Pipeline — Documentação base para automação (v3)

Esta pasta consolida **tudo o que é preciso para planejar e implementar a automação do pipeline** sem precisar varrer o código a cada vez. A Fase 0+1 do `AUTOMATION_PLAN.md` deve ser implementável **lendo apenas estes arquivos**.

Contexto:
- **Agente anterior removido** (extractor, vision-tick, field-rules, reclassify-deep). Pipeline hoje é **100% manual**.
- **Agente de WhatsApp (auto-reply)** continua ativo e independente — não está documentado aqui.
- Base empírica: estudo de 441 leads / 3.973 mensagens / 306 áudios da Clínica ÓR (`docs/estudo/`).

## Como usar esta pasta

| Quando você quiser… | Leia |
|---|---|
| Quais colunas existem, flags, locks por stage | [`STAGES.md`](./STAGES.md) |
| Cenários reais + padrões cross-coluna + erros do agente antigo | [`SCENARIOS.md`](./SCENARIOS.md) |
| Tabelas, triggers, enums, gates do banco | [`DATABASE.md`](./DATABASE.md) |
| Catálogo de custom_fields, enums, whitelist de tags, writers | [`CUSTOM_FIELDS_E_TAGS.md`](./CUSTOM_FIELDS_E_TAGS.md) |
| Amostra real pseudonimizada de 5 leads/stage | [`LEAD_SAMPLES.md`](./LEAD_SAMPLES.md) |
| Plano de fases (v3) com 10 gates e regras | [`AUTOMATION_PLAN.md`](./AUTOMATION_PLAN.md) |
| Evidência detalhada por coluna do estudo | [`docs/estudo/`](../estudo/README.md) |

## Arquitetura v3 em uma frase

**1 Classifier (LLM) + 1 Summarizer (LLM incremental) + Rule Engine (código puro)**. Stages se movem por código determinístico via 10 gates de segurança. LLM só sugere; nunca decide movimento.

## Princípios

1. **Tudo opt-in por regra** em `app_settings.automation.<rule>.enabled`. Off by default.
2. **`lead_stage_history.source = 'auto:<rule>'`** em toda movimentação automática.
3. **Lock manual (7d)** bloqueia movimentação automática, **não** bloqueia escrita de tags/custom_fields/ai_summary.
4. **`lock_auto_move=true`** em stages sensíveis (hoje: `Procedimento pago`).
5. **Idempotência** via `lead_events` com chave estável (ex: `appointment_id`).
6. **Tags sempre MERGE**, custom_fields enum-validados, nunca tocar em `pipeline_id`.
7. **Humano > IA** em conflitos de custom_fields nos últimos 7 dias.
8. **Stages finais excluídos de scans temporais** + leads com appointment futuro excluídos do inactivity.

## Próximo passo

Quando quiser executar: _"vamos fazer a Fase 0"_. Migration + helpers + UI sai junta. Depois Fase 1.1 (motor `auto:appointment-*`) já entrega o fechamento do bug original do estudo ("pagou a consulta e ficou em Qualificação").

---
title: "Pipeline — Documentação para planejamento de automação (v4.1)"
topic: kanban
kind: map
audience: agent
updated: 2026-06-18
summary: "Hub da documentação do pipeline da Clínica ÓR (v4.1, 11 colunas). Inclui 8 decisões D1–D8, reator de ação humana, tag precisa_atencao_humana, e lembretes via UI /automations."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/SCENARIOS.md
  - docs/pipeline/DATABASE.md
  - docs/pipeline/AUTOMATION_PLAN.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
  - docs/pipeline/LEAD_SAMPLES.md
  - docs/estudo-geral.md
---

# Pipeline — Documentação base para automação (v4.1)

Esta pasta consolida **tudo o que é preciso para planejar e implementar a automação do pipeline** sem precisar varrer o código. A Fase 0+1 do `AUTOMATION_PLAN.md` deve ser implementável **lendo apenas estes arquivos**.

## Contexto

- **Agente anterior removido** (extractor, vision-tick, field-rules, reclassify-deep). Pipeline hoje é **100% manual**.
- **Agente de WhatsApp (auto-reply)** continua ativo e independente.
- Base empírica: estudo de 441 leads / 3.973 mensagens / 306 áudios da Clínica ÓR (`docs/estudo/`).
- **v4.1**: incorpora o brief consolidado da clínica e fecha 8 decisões + 13 perguntas abertas.

## Mudanças v3 → v4.1

| # | Decisão | Resumo |
|---|---|---|
| D1 | "Procedimento pago" eliminada | Vira campo `status_financeiro`. Pipeline 12 → **11 colunas**. |
| D2 | "Procedimento agendado" → **"Tratamento agendado"** | Termo "procedimento" sai do vocabulário operacional. |
| D3 | Paciente antigo não sai do stage ao agendar | Controle por tags + campos + calendário. |
| D4 | Inatividade tiered | 24h / 3d / 7d em vez de regra única de 5d. |
| D5 | Move automático ao passar do horário | Humano reverte via `status_consulta`. |
| D6 | Lembretes via UI `/automations` | Não há regra `auto:reminder-*` codificada. Usa `automations-tick` existente. |
| D7 | Reator de ação humana | Quando humano move/edita, IA infere consequência ou trava. |
| D8 | Tag `precisa_atencao_humana` | Fallback universal de "lead travado". Vira fila de retreino. |

## Lista de colunas v4.1 (11)

1. Leads de entrada
2. Qualificação
3. Consulta agendada
4. Consulta finalizada
5. **Tratamento agendado** (renomeada — D2)
6. Em tratamento
7. Paciente antigo *(final)*
8. Sem resposta
9. Nutrição inativa *(final)*
10. B2B / Stakeholders *(terminal)*
11. Desqualificado / Fora de escopo *(terminal)*

## Como usar esta pasta

| Quando você quiser… | Leia |
|---|---|
| Quais colunas existem, flags, locks por stage | [`STAGES.md`](./STAGES.md) |
| Cenários reais + padrões + erros + reator humano | [`SCENARIOS.md`](./SCENARIOS.md) |
| Tabelas, triggers, enums, campos novos | [`DATABASE.md`](./DATABASE.md) |
| Catálogo de custom_fields, whitelist de tags | [`CUSTOM_FIELDS_E_TAGS.md`](./CUSTOM_FIELDS_E_TAGS.md) |
| Amostra real pseudonimizada + casos a migrar | [`LEAD_SAMPLES.md`](./LEAD_SAMPLES.md) |
| Plano de fases + 11 gates + reator humano + D1–D8 | [`AUTOMATION_PLAN.md`](./AUTOMATION_PLAN.md) |
| Evidência detalhada por coluna do estudo | [`docs/estudo/`](../estudo/README.md) |

## Arquitetura v4.1 em uma frase

**1 Classifier (LLM) + 1 Summarizer (LLM incremental) + Rule Engine (código puro) + Reator humano (Postgres trigger + edge function).** Stages se movem por código determinístico via 11 gates de segurança. LLM só sugere; nunca decide movimento. Lembretes vivem em `/automations`.

## Princípios

1. **Tudo opt-in por regra** em `app_settings.automation.<rule>.enabled`. Off by default.
2. **`lead_stage_history.source`** preenchido com `'auto:<rule>'`, `'manual'`, `'ui'`, `'reator:<inferencia>'`, ou `'system:<reason>'`.
3. **Lock manual (7d)** bloqueia movimentação automática, não bloqueia escrita de tags/fields/summary. Renovado pelo reator.
4. **Idempotência** via `lead_events` com chave estável.
5. **Tags sempre MERGE**, custom_fields enum-validados, nunca tocar em `pipeline_id`.
6. **Humano > IA** em conflitos de custom_fields nos últimos 7 dias.
7. **Stages finais excluídos de scans temporais** + leads com appointment futuro excluídos do followup.
8. **Status financeiro independente de stage** (D1).
9. **Paciente antigo não move por automação** (D3).
10. **Lembretes não em código** (D6).
11. **IA com baixa confiança → `precisa_atencao_humana`** (D8).
12. **Classifier nunca escreve em `appointments`** (G11).

## Lembretes — onde configurar

**Não em código.** Use a UI `/automations` (sistema existente). Cada tipo de procedimento ganha sua automation `before_appointment` com 2 offsets (1440min e 60min). Detalhes em `SCENARIOS.md` C9.

## Próximo passo

Quando quiser executar: _"vamos fazer a Fase 0"_. Migration (renomeia/elimina stages, cria campos novos, toggles em `app_settings`) + helpers + UI sai junta. Depois Fase 1.1+1.2 já entrega o fechamento do bug original ("pagou a consulta e ficou em Qualificação") + welcome message + transição por resposta humana.

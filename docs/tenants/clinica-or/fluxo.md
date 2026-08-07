---
title: "Clínica ÓR — Fluxo novo do pipeline"
topic: kanban
kind: flow
audience: agent
updated: 2026-07-17
summary: "Fluxo novo do pipeline da Clínica ÓR: transição para Sem Resposta após 48h, ciclo mensal para Paciente Antigo, duas geladeiras de nutrição com tags/segmentos automáticos e relatório Dia 1."
code_refs:
  - supabase/functions/automations-tick/
  - supabase/functions/pipeline-inactivity-tick/
  - supabase/functions/pipeline-monthly-cycle-or/
  - supabase/functions/report-finalizados-mensal-or/
  - src/components/tracking/MonthlyFinalizadosReportCard.tsx
  - src/pages/Tracking.tsx
related_docs:
  - docs/pipeline/runtime/STAGES_LIVE.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/runtime/TRIGGERS_AUDIT.md
---


# Clínica ÓR — Fluxo novo do pipeline

Escopo: **somente** `clinic_id = cf038458-457d-4c1a-9ac4-c88c3c8353a1`, pipeline `Clínica ÓR` (`17c27f4d-8256-4ea7-b5b9-ed706494f686`).

## Diagrama

```mermaid
flowchart TD
    %% ---------------- NÓS DO KANBAN ----------------
    LE[Leads de Entrada]
    Q[Qualificação]
    B2B[Desqualificado / B2B]
    
    SR[Sem Resposta]
    NI[Nutrição Inativa]
    
    CA[Consulta Agendada]
    TA[Tratamento Agendado]
    
    CF[Consulta Finalizada]
    TF[1ª Sessão Finalizada]
    
    PA[Paciente Antigo]
    NA[Nutrição Antigos]

    %% ---------------- FLUXOS PRINCIPAIS ----------------
    LE -- Secretária responde --> Q
    
    LE -. Tag b2b/desqualificado .-> B2B
    Q -. Tag b2b/desqualificado .-> B2B

    Q -- Preenche data consulta --> CA
    Q -- Preenche data tratamento --> TA
    
    CA -- Realizado --> CF
    TA -- Realizado --> TF
    
    CF -- Cron 1º dia do mês --> PA
    TF -- Cron 1º dia do mês --> PA

    %% ---------------- FLUXOS TEMPORAIS (GELADEIRA) ----------------
    Q -. 48h sem resposta .-> SR
    SR -. 7 dias parado .-> NI
    
    PA -. 60 dias sem inbound .-> NA

    %% ---------------- REATIVAÇÃO (WAKEUP TRIGGER) ----------------
    SR == Inbound Wakeup ==> Q
    NI == Inbound Wakeup ==> Q
    NA == Inbound Wakeup ==> Q
```

## Stages (renome + nova)

| Pos | Nome novo | Mudança |
|---|---|---|
| 6 | **1ª Sessão Finalizada** | renomeada de "Em tratamento" (id mantido `2a352661-...`) |
| 8 | **Nutrição Inativa (Geladeira de Leads)** | renomeada de "Nutrição inativa" (id mantido `64356dbe-...`) |
| 11 | **Nutrição Antigos (>60d)** | nova |

## Regras temporais (resumo)

| Origem | Gatilho | Destino / Ação |
|---|---|---|
| Qualificação | +48h sem resposta (`no_reply_after`) | Move → Sem Resposta |
| Sem Resposta | +7 dias parado (`stage_idle`) | Move → Nutrição Inativa (Geladeira) |
| 1ª Sessão Finalizada | Dia 1 do mês (cron `pipeline-monthly-cycle-or`) | Move → Paciente Antigo |
| Paciente Antigo | +60d sem inbound | Move → Nutrição Antigos (>60d) |
| Qualquer geladeira | mensagem inbound | Move → Qualificação |

## Tags automáticas (coluna `pipeline_stages.auto_tag_on_enter`)

| Stage | Tags aplicadas ao entrar |
|---|---|
| Sem Resposta | `sem_resposta` |
| Nutrição Inativa (Geladeira de Leads) | `nutricao_inativa`, `segmento_nutricao_leads` |
| Nutrição Antigos (>60d) | `nutricao_antigos`, `segmento_nutricao_antigos` |
| Paciente Antigo | `paciente_antigo`, `segmento_paciente_antigo` |
| Consulta Finalizada | `consulta_finalizada_mes`, `segmento_relatorio_dia1` |
| 1ª Sessão Finalizada | `tratamento_finalizado_mes`, `segmento_relatorio_dia1` |

Trigger: `apply_stage_auto_tags()` após INSERT em `lead_stage_history` mescla as tags no array `leads.tags` (sem duplicar).

## Segmentos de sistema (`email_segments.is_system = true`)

- `seg_nutricao_leds` — `tags @> {segmento_nutricao_leads}`
- `seg_nutricao_antigos` — `tags @> {segmento_nutricao_antigos}`
- `seg_paciente_antigo` — `tags @> {segmento_paciente_antigo}`
- `seg_relatorio_dia1` — `tags @> {segmento_relatorio_dia1}` no mês corrente

## Relatório Dia 1

Edge function `report-finalizados-mensal-or` (cron `0 6 1 * *`, job `report-finalizados-mensal-or-day1`) conta leads que entraram em `Consulta Finalizada` e `1ª Sessão Finalizada` no mês anterior via `lead_stage_history`, persiste em `clinic_monthly_reports` (upsert), envia email para o admin usando o template `or-monthly-finalizados-report` e renderiza card em `/tracking` via `MonthlyFinalizadosReportCard.tsx` (últimos 12 meses).

## Sequências (Fase 5)

3 sequências `pipeline_enter` criadas em `message_sequences` + `stage_sequence_bindings` (`on_enter`), todas **disabled** aguardando copy:

- `ÓR — Nutrição Leads` → stage Nutrição Inativa (Geladeira de Leads)
- `ÓR — Nutrição Antigos` → stage Nutrição Antigos (>60d)
- `ÓR — Reativação Paciente Antigo` → stage Paciente antigo

Todas com `stop_on_reply=true`. Ativar em `/sequences` quando as mensagens estiverem prontas.


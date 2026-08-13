---
title: "Gatilhos e Automações (Rule Engine V7) — Clínica ÓR"
topic: kanban
kind: feature
audience: agent
updated: 2026-07-27
summary: "Rule engine estrito da Clínica ÓR: gatilhos determinísticos baseados em ação humana e inatividade. IA de movimentação depreciada para este tenant."
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
code_refs:
  - supabase/functions/pipeline-deterministic/
  - supabase/functions/pipeline-monthly-cycle-or/
  - supabase/functions/report-finalizados-mensal-or/
related_docs:
  - docs/tenants/clinica-or/README.md
  - docs/tenants/clinica-or/agentes-e-modelos.md
---

# Gatilhos e Automações (Rule Engine V7) — Clínica ÓR

> **⚠️ AVISO DE ISOLAMENTO (TENANT SPECIFIC):** 
> As regras e o comportamento estrito documentados aqui se aplicam **EXCLUSIVAMENTE** ao tenant `clinica-or`. A inteligência artificial de movimentação foi desligada apenas para este tenant. Outras clínicas e tenants continuam utilizando suas próprias lógicas de agentes classificadores.

O "Rule Engine V7" da Clínica ÓR aboliu a IA para mover cards. Agora, o pipeline opera 100% de forma determinística, engatilhado por ações da secretária no banco de dados ou por cron jobs avaliando inatividade.

## Regras Determinísticas de Ação Humana (`auto:human-action`)

As automações básicas rodam sem IA e são disparadas por ações reais:

- **Gatilho de Agendamento (Inserção de Horário):** 
  - Quando a secretária preenche um horário de consulta ou tratamento no card (seja inserindo a data/hora via UI ou criando um compromisso no banco).
  - **Ação:** O gatilho intercepta a atualização e move automaticamente o card para a coluna "Consulta Agendada" ou "Tratamento Agendado" correspondente, acionando também as automações de lembretes (se aplicável).
- **Gatilho de Primeira Resposta (`auto:secretary-replied`):** 
  - Quando a secretária envia a primeira mensagem ativa (direção outbound).
  - **Ação:** O lead é movido de "Leads de Entrada" para "Qualificação".
- **Gatilho de Atualização de Status da Consulta (`auto:appointment-*`):**
  - Triggers no PostgreSQL espelham o status do compromisso no Kanban:
  - `realizado`: Move para "Consulta finalizada" ou avança o ciclo de "Em tratamento".
  - `faltou`: Manda o lead para "Sem Resposta", aplica tag `no_show`.
  - `cancelado`: Manda para "Qualificação" com a tag `reagendamento_pendente`.
- **Gatilho de Tag (Exceção B2B / Desqualificação):**
  - Se a IA Tipificadora sugerir ou se a secretária adicionar a tag `b2b` ou `desqualificado`, um gatilho oculto transfere o lead imediatamente para a coluna "Desqualificado / B2B".

## Automação de Inatividade (Geladeira Temporal)
Como a IA não julga mais o "desinteresse", usamos *Service Level Agreements* (SLAs) estritos de inatividade, rodando no cron:

- **SLA 1 - Falta de Resposta (Ex: 48h):** Após X horas sem resposta do lead na fase de Qualificação, o sistema o move automaticamente para a coluna "Sem Resposta". (O prazo exato será parametrizado conforme a nova lógica em desenvolvimento).
- **SLA 2 - Geladeira (Ex: 7 dias):** Se o lead permanecer intocado na coluna "Sem Resposta" por um número definido de dias, ele cai automaticamente para a "Nutrição Inativa" (Geladeira de Leads).
- **SLA 3 - Geladeira Longa (Ex: 60 dias):** Cron job de SLA exclusivo para "Paciente Antigo". Se o paciente não tiver nenhuma interação (inbound) nos últimos 60 dias, ele é movido para "Nutrição Antigos" para receber campanhas de reengajamento.

## Reator Humano Simplificado
Quando a secretária edita um estágio do card manualmente na UI, o sistema apenas aceita o movimento. Não há mais necessidade de "bloquear a IA por 7 dias" (`manual_lock_until`), pois a IA de movimentação já não atua sobre a Clínica ÓR.

## Limpeza e Relatório Mensal: Dia 1
A *edge function* `report-finalizados-mensal-or` (cron `0 6 1 * *`) continua operando normalmente. Contabiliza e processa os leads em "Consulta Finalizada", envia relatório e a `monthly_cleanup` varre as colunas enviando todos para "Paciente Antigo".

## Wakeup Inbound (Reativação automática de geladeira)
O trigger determinístico `fn_clinica_or_wakeup_inbound` se mantém: quando um lead da Clínica ÓR em `Sem resposta` ou `Nutrição` responde no WhatsApp, ele volta automaticamente para `Qualificação` e ganha a tag `reativacao`.

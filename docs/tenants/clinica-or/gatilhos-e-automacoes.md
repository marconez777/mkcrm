---
title: "Gatilhos e Automações (Rule Engine) — Clínica ÓR"
topic: kanban
kind: feature
audience: agent
updated: 2026-07-17
summary: "Rule engine da Clínica ÓR: gatilhos determinísticos, geladeiras de inatividade, reator humano e relatório mensal Dia 1."
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/functions/pipeline-inactivity-tick/
  - supabase/functions/pipeline-monthly-cycle-or/
  - supabase/functions/report-finalizados-mensal-or/
related_docs:
  - docs/tenants/clinica-or/README.md
  - docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md
---

# Gatilhos e Automações (Rule Engine) — Clínica ÓR

O "Rule Engine" processa regras determinísticas sem depender do LLM. Operam na camada do banco ou via *edge functions* engatilhadas por crons e Webhooks.

## Regras Determinísticas (`auto:*`)

As automações básicas rodam sem IA, geralmente disparadas por webhooks ou CRONs.
- `auto:novo-lead`: Disparado na inserção via `evolution-webhook`. Envia mensagem de boas-vindas da clínica e define `source='system'`.
- `auto:secretary-replied`: Quando a secretária envia a primeira mensagem (direção outbound), o lead move de "Leads de Entrada" para "Qualificação".
- `auto:appointment-*`: Um conjunto de triggers PostgreSQL associados ao status dos Agendamentos:
  - `agendado`: Move o card para "Consulta agendada" ou "Tratamento agendado" (exceto se for Paciente Antigo, neste caso apenas anexa a tag e mantém a coluna).
  - `realizado`: Move para "Consulta finalizada" ou incrementa o ciclo em "Em tratamento".
  - `faltou`: Manda o lead para "Sem Resposta", aplica tag `no_show` e agenda task de reagendamento.
  - `cancelado`: Manda para "Qualificação" com a tag `reagendamento_pendente`.

## Automação de Inatividade (Geladeira)
Baseada na lógica de *tiers*, orquestrada pela edge function `automations-tick`:
- `no_reply_after` (48h): Após 48 horas sem resposta do lead na fase de Qualificação, o sistema o move automaticamente para a coluna "Sem Resposta".
- `stage_idle` (7 dias): Se o lead permanecer intocado na coluna "Sem Resposta" por 168 horas (7 dias), a automação "Geladeira - 7 Dias sem resposta" o move automaticamente para a "Nutrição inativa" (Geladeira de Leads).

## Lembretes de Consulta
Diferente da inatividade de pipeline, os avisos operacionais de consulta (ex: 24h e 1h antes) vivem isolados em **Automations UI** (`/automations`), rodando via `automations-tick`. O sistema é esperto o suficiente para suprimir lembretes redundantes para marcações de última hora.

## Reator Humano (Human Reactor)
Quando a secretária edita um estágio do card manualmente na UI, um *hook* (`pipeline-human-reactor`) reage à ação:
- O sistema bloqueia a IA de intervir ou sobrescrever aquele lead por 7 dias (`manual_lock_until = now() + 7d`).
- Se a secretária move para "Sem Resposta", a IA paralisa os follow-ups agendados por 24h para deixar o humano cuidar.
- Se a secretária cancela uma consulta pelo card, o reator captura a intenção e repassa pro sistema de compromissos automaticamente, disparando toda a cadeia de `auto:appointment-cancelado`.

## Limpeza e Relatório Mensal: Dia 1
A *edge function* `report-finalizados-mensal-or` (cron `0 6 1 * *`) contabiliza e processa os leads que alcançaram "Consulta Finalizada" e "1ª Sessão Finalizada" no mês. Registra no DB, envia por email o template `or-monthly-finalizados-report` para a gestão, e atualiza o painel Tracking do frontend.
Em seguida, o gatilho `monthly_cleanup` (via `automations-tick`) atua movendo todos os cards destas colunas para "Paciente Antigo", esvaziando a seção de finalizados para o novo mês.

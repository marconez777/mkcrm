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
Baseada na lógica de *tiers*, orquestrada pelo CRON `pipeline-inactivity-tick`:
- `auto:followup-24h`: 24h sem resposta do lead em Qualificação dispara o Follow-up #1.
- `auto:followup-3d`: 48h adicionais (total 3 dias) dispara o Follow-up #2.
- `auto:followup-7d-nutricao`: 7 dias no estágio Sem Resposta empurra o lead automaticamente para a "Nutrição inativa" (Geladeira de Leads).

## Lembretes de Consulta
Diferente da inatividade de pipeline, os avisos operacionais de consulta (ex: 24h e 1h antes) vivem isolados em **Automations UI** (`/automations`), rodando via `automations-tick`. O sistema é esperto o suficiente para suprimir lembretes redundantes para marcações de última hora.

## Reator Humano (Human Reactor)
Quando a secretária edita um estágio do card manualmente na UI, um *hook* (`pipeline-human-reactor`) reage à ação:
- O sistema bloqueia a IA de intervir ou sobrescrever aquele lead por 7 dias (`manual_lock_until = now() + 7d`).
- Se a secretária move para "Sem Resposta", a IA paralisa os follow-ups agendados por 24h para deixar o humano cuidar.
- Se a secretária cancela uma consulta pelo card, o reator captura a intenção e repassa pro sistema de compromissos automaticamente, disparando toda a cadeia de `auto:appointment-cancelado`.

## Relatório Mensal: Dia 1
A *edge function* `report-finalizados-mensal-or` (cron `0 6 1 * *`) contabiliza e processa os leads que alcançaram "Consulta Finalizada" e "1ª Sessão Finalizada" no mês. Registra no DB, envia por email o template `or-monthly-finalizados-report` para a gestão, e atualiza o painel Tracking do frontend.

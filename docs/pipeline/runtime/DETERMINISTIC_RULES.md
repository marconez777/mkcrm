---
title: "Regras determinísticas (pipeline-deterministic) — V6"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-20
summary: "Inventário completo das regras auto:* do pipeline-deterministic: novo-lead, secretary-replied, appointment-sync, field-changed (ciclo-concluido + modality-guard), inactivity tiered 24h/3d/7d, reactivation, human-reactor."
related_docs:
  - docs/pipeline/runtime/ARCHITECTURE.md
  - docs/pipeline/runtime/GATES.md
---

# Regras determinísticas — `pipeline-deterministic`

O roteador determinístico age como a "Força Bruta" e o "Músculo" do sistema, em contraposição ao "Cérebro" da IA (os 5 Agentes).
Ele possui 7 actions (regras `auto:*`). Toda regra que move um card chama a função central `pipelineMove()` e, portando, respeita as camadas de Gates e Idempotência.

## Sumário de Gatilhos

| Action | Trigger / Cron | Source registrado | Toggle | Stage destino |
|---|---|---|---|---|
| `novo-lead` | INSERT `leads` | `auto:novo-lead` | `automation.novo_lead.enabled` | Novo |
| `secretary-replied` | INSERT `messages` (from_me) | `auto:secretary-replied` | `automation.secretary_replied.enabled` | Qualificação (só se em Novo) |
| `appointment-sync` | INSERT/UPDATE `appointments` | `auto:appointment-sync` | 4 toggles distintos | varia (vide abaixo) |
| `field-changed` (ciclo) | UPDATE `leads.custom_fields` | `auto:ciclo-concluido` | `automation.ciclo_concluido.enabled` | Paciente antigo + lock 90d |
| `field-changed` (guard) | UPDATE `leads.custom_fields` | `auto:modality-guard` | `automation.modality_guard.enabled` | n/a (apenas insere tag) |
| `inactivity-tick` | cron `*/15` | `auto:followup-7d` | 3 toggles | Nutrição inativa (só tier 7d) |
| `reactivation-tick` | cron `0 7` | `auto:reactivation` | `automation.reactivation.enabled` | n/a (apenas insere tag) |
| `human-reactor-tick`| cron `0 8` | `auto:human-reactor` | `automation.human_reactor.enabled` | n/a (cria task de revisão) |

## Detalhamento

### `auto:novo-lead`
Garante que qualquer lead inserido no Supabase vá para a coluna de Entrada (Novo). O trigger no banco faz o POST HTTP para a Edge Function via `pg_net`.

### `auto:secretary-replied`
Quando a secretária dá o primeiro "Oi" (from_me = true), o lead avança de "Novo" para "Qualificação". Impede que leads não abordados fiquem misturados com leads que já estão em conversa.

### `auto:appointment-sync` (Sincronização de Agenda)
A IA (V6) NUNCA toca na tabela de `appointments`. A regra bruta sincroniza o Kanban sempre que o status do appointment muda na tabela:
- `agendado` (consulta/retorno) → **Consulta agendada**
- `agendado` (procedimento) → **Tratamento agendado**
- `realizado` (consulta) → **Consulta finalizada**
- `realizado` (procedimento) → **Em tratamento** + Incrementa chip `sessoes_realizadas`.
- `faltou` → **Sem resposta** + Tag `reagendamento_pendente`.
- `cancelado` → **Qualificação** + Tag `reagendamento_pendente`.

> Se o lead já é um "Paciente antigo", o Gate D3 bloqueia esse Move, pois o paciente não sai da sua coluna inativa, mas a sync ocorre normalmente no log e nas tags.

### `auto:ciclo-concluido`
Se a clínica marca `ciclo_concluido = true` nos Custom Fields, o lead é movido para **Paciente antigo** e congelado com `manual_lock_until = now() + 90 dias`. A IA (V6) é incapaz de movimentá-lo durante este lock.

### Inatividade Temporal (SLA Cron Tick)
Varredura contínua de inatividade (`last_message_at`).
- **7 dias sem resposta**: Move para "Nutrição inativa" + adiciona tag `precisa_atencao_humana`.
- **60 dias em Paciente Antigo**: Move paciente antigo esquecido para "Nutrição inativa".
- **3 dias e 24h**: Não realizam moves, apenas disparam `lead_events` na linha do tempo para relatórios e possíveis gatilhos de UI.

### `auto:human-reactor` (Tasks)
Diariamente às 08:00 BRT, varre todos os leads que possuem a tag `precisa_atencao_humana` e estão estagnados há > 7 dias. Cria uma `lead_task` cobrando que a clínica revise o "lead travado".

## Hooks de Saída Comuns
Todo move executado pelo Helper `pipelineMove()` efetua em background:
1. Gravação em `lead_stage_history`.
2. Emissão de evento idempotente `pipeline_move_attempted`.
3. Gatilho para o `pipeline-post-move-verifier` (A2 - Auditor de Moves).
4. Gatilho para iniciar sequências de mensagem configuradas naquele estágio (`applyStageBindings`).

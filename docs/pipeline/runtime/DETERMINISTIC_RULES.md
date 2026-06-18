---
title: "Regras determinísticas (pipeline-deterministic)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Inventário completo das regras auto:* do pipeline-deterministic: novo-lead, secretary-replied, appointment-sync, field-changed (ciclo-concluido + modality-guard), inactivity tiered 24h/3d/7d, reactivation, human-reactor."
code_refs:
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/migrations/20260618022933_e4ca1829-7d6c-4cd1-8f70-e5bcb788f35a.sql
related_docs:
  - docs/pipeline/runtime/ARCHITECTURE.md
  - docs/pipeline/runtime/GATES.md
---

# Regras determinísticas — `pipeline-deterministic`

Roteador único com 7 actions. Cada action é uma regra `auto:*`. Toda regra que move card chama `pipelineMove()` (gates G1–G5/G8/D3 + hooks A2 + stage bindings).

## Sumário

| Action | Trigger / Cron | Source registrado | Toggle | Stage destino |
|---|---|---|---|---|
| `novo-lead` | INSERT `leads` | `auto:novo-lead` | `automation.novo_lead.enabled` | Novo (canônico) |
| `secretary-replied` | INSERT `messages` (from_me=true) | `auto:secretary-replied` | `automation.secretary_replied.enabled` | Qualificação (só se atual=Novo) |
| `appointment-sync` | INSERT/UPDATE status `appointments` | `auto:appointment-sync` | 4 toggles (ver abaixo) | varia c/ status×kind |
| `field-changed` → ciclo-concluido | UPDATE `leads.custom_fields` | `auto:ciclo-concluido` | `automation.ciclo_concluido.enabled` | Paciente antigo + lock 90d |
| `field-changed` → modality-guard | UPDATE `leads.custom_fields` | `auto:modality-guard` | `automation.modality_guard.enabled` | n/a (só tag) |
| `inactivity-tick` (cron */15) | cron `pipeline-inactivity-tick` | `auto:followup-24h` / `auto:followup-3d` / `auto:followup-7d` | 3 toggles | Nutrição inativa (só tier 7d) |
| `reactivation-tick` (cron 0 7) | cron `pipeline-reactivation-tick` | `auto:reactivation` (event) | `automation.reactivation.enabled` | n/a (só tag) |
| `human-reactor-tick` (cron 0 8) | cron `pipeline-human-reactor-tick` | `auto:human-reactor` (event) | `automation.human_reactor.enabled` | n/a (só task) |

## Detalhe por regra

### `auto:novo-lead`

Garante que todo lead recém-criado caia em "Novo".

- **Disparo**: trigger `trg_leads_auto_novo_lead` AFTER INSERT em `leads` → `pg_net.http_post` com `{action:'novo-lead', lead_id:NEW.id}`.
- **Precondições**: `lead.pipeline_id` existe, stage atual ≠ "Novo".
- **Ação**: `pipelineMove(lead → Novo, source='auto:novo-lead', ruleKey='automation.novo_lead.enabled', idempotencyKey='novo-lead:<leadId>')`.
- **Evento**: `lead_events.type='auto:novo-lead'`.

### `auto:secretary-replied`

Move o lead de Novo → Qualificação quando a secretária envia primeira mensagem.

- **Disparo**: trigger `trg_messages_auto_secretary` AFTER INSERT em `messages`. Filtra `from_me=true`.
- **Precondições**: stage atual = "Novo".
- **idempotencyKey**: `secretary:<messageId>`.
- **Pegada**: dispara para **toda** mensagem `from_me=true`, mas só age se ainda em Novo.

### `auto:appointment-sync` (5 sub-regras)

Switch por `status` do appointment. Toggles separados (todos ativos):

| `status` | `kind` | Stage destino | custom_fields patch | Tag adicionada |
|---|---|---|---|---|
| `agendado` | consulta | Consulta agendada | — | — |
| `agendado` | retorno | Consulta agendada | — | — |
| `agendado` | procedimento | Tratamento agendado | — | — |
| `realizado` | consulta | Consulta finalizada | `status_consulta='realizada'` | — |
| `realizado` | procedimento | Em tratamento | `sessoes_realizadas += 1` | — |
| `faltou` | qualquer | Sem resposta | `status_consulta='faltou'` | `reagendamento_pendente` |
| `cancelado` | qualquer | Qualificação | `status_consulta='cancelada'` | `reagendamento_pendente` |

- **idempotencyKey**: `appt:<appointmentId>:<status>` (move só ocorre 1x por mudança de status).
- **Guard D3**: se stage atual = "Paciente antigo", move é bloqueado pelo helper (paciente antigo agenda sem sair do stage); o patch de custom_fields e a tag ainda são aplicados.

### `auto:ciclo-concluido` (field-changed)

Quando humano marca `custom_fields.ciclo_concluido` de `false`→`true`:

1. Move lead para "Paciente antigo".
2. Se move OK, seta `manual_lock_until = now() + 90 dias` (congela o card).

### `auto:modality-guard` (field-changed)

Quando `modalidade_preferida` muda para `online` → adiciona tag `modalidade_online`. Sem move.

### Inatividade tiered (cron `*/15 * * * *`)

Roda em leads não-arquivados, `is_internal_contact=false`, stage ∈ {Novo, Qualificação, Consulta agendada, Tratamento agendado} (resolvidos por alias). Limit 2000/tick.

Hierarquia (cada lead cai em UMA tier por vez):

| Tier | Condição | Ação | Idempotência |
|---|---|---|---|
| **7d nutrição** | `last_message_at < now()-7d` | Move → Nutrição inativa (`source='auto:followup-7d'`) + tag `precisa_atencao_humana` + event | idempotencyKey `inactivity:<leadId>:7d:<YYYY-MM-DD>` |
| **3d follow-up** | else if `last_message_at < now()-3d` | Só `lead_events.type='auto:followup-3d'` (sem tag/sem move) | event lookup do dia |
| **24h follow-up** | else if `last_human_activity_at < now()-24h` | Só `lead_events.type='auto:followup-24h'` | event lookup do dia |

> **Pegada**: tiers 24h e 3d **não** geram mensagens nem moves — são apenas marcações temporais para humanos/UI. A geração de mensagens vive em `/automations` (sistema separado).

### `auto:reactivation` (cron `0 7 * * *`)

Para cada lead em "Nutrição inativa" há ≥30d cujo `custom_fields.interesse_tratamento=true` e que ainda não tem tag `reativacao`: adiciona tag `reativacao` + evento. Sem move.

### `auto:human-reactor` — tasks (cron `0 8 * * *`)

Para cada lead com tag `precisa_atencao_humana` cujo `updated_at < now()-7d`: se não há `lead_task` aberta com prefixo "Revisar lead travado", cria uma com `due_at = now()+24h`. Evento `auto:human-reactor` registrado.

## Hooks de saída comuns

Todo move bem-sucedido via `pipelineMove()`:

1. Cria `lead_stage_history` com `source` preenchido.
2. Cria `lead_events.type='pipeline_move_attempted'` com `payload.idempotency_key`.
3. Dispara fetch async para `pipeline-post-move-verifier` (A2).
4. Dispara fetch async para `applyStageBindings` → cria enrollments em `message_sequence_enrollments`.

## Regras NÃO implementadas como `auto:*`

(comparado ao plano em `AUTOMATION_PLAN.md`)

- `auto:welcome-message` — lembretes vivem em `/automations` (D6).
- `auto:reminder-*` — idem.
- `auto:payment-confirmed` — implementado em `_shared/pipeline-tasks.ts::runPaymentConfirmed`, mas acionado **só pelo webhook** `pipeline-payment-webhook`, não por trigger PG. Sem provedor real integrado hoje.
- `auto:urgency-flag`, `auto:field-patch`, `auto:tags-merge`, `auto:agendamento-sugerido` — toggles existem em `app_settings` mas o classifier não tem código para gravar esses sources distintos; o caminho real é via `intent` (objeção/judicialização/etc.).

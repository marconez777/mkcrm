---
title: "Regras determinísticas (pipeline-deterministic)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-22
summary: "Inventário completo das regras auto:* do pipeline-deterministic: novo-lead, secretary-replied, appointment-sync, field-changed (ciclo-concluido + modality-guard), inactivity tiered 24h/3d/7d/60d, monthly-sweep (Dia 1), reactivation, human-reactor."
code_refs:
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/migrations/20260618022933_e4ca1829-7d6c-4cd1-8f70-e5bcb788f35a.sql
  - supabase/migrations/20260622020534_d378996e-880a-4893-8ee9-a226da9b39e5.sql
related_docs:
  - docs/pipeline/runtime/ARCHITECTURE.md
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/STAGES_LIVE.md
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
| `inactivity-tick` (cron */15) | cron `pipeline-inactivity-tick` | `auto:followup-24h` / `auto:followup-3d` / `auto:followup-7d` / `auto:inactivity-tick` | 4 toggles | Nutrição inativa (tier 7d) · Nutrição Antigos (tier 60d) |
| `monthly-sweep-tick` (cron `0 3 1 * *`) | cron `pipeline-monthly-sweep-paciente-antigo` | `auto:monthly-sweep` | `automation.monthly_sweep_paciente_antigo.enabled` | Paciente antigo (+ `eh_paciente_antigo=true`) |
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
| `realizado` | procedimento | 1ª Sessão Finalizada | `sessoes_realizadas += 1` | — |
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

Roda em leads não-arquivados, `is_internal_contact=false`.
- **Tiers 24h, 3d, 7d**: stage ∈ {Novo, Qualificação, Consulta agendada, Tratamento agendado}
- **Tier 60d**: stage = Paciente antigo

Limit 2000/tick.

Hierarquia (cada lead cai em UMA tier por vez):

| Tier | Condição | Ação | Idempotência |
|---|---|---|---|
| **60d Paciente antigo** | `last_inbound_at < now()-60d` (ou `last_message_at < now()-60d` se `last_inbound_at` for null) em Paciente antigo | Move → **Nutrição Antigos** (`source='auto:inactivity-tick'`) + evento `auto:inactivity-paciente-antigo-nutricao-antigos` | idempotencyKey `inactivity:paciente_antigo:antigos:<leadId>:<YYYY-MM>` |
| **7d nutrição** | `last_message_at < now()-7d` | Move → Nutrição inativa (`source='auto:followup-7d'`) + tag `precisa_atencao_humana` + event | idempotencyKey `inactivity:<leadId>:7d:<YYYY-MM-DD>` |
| **3d follow-up** | else if `last_message_at < now()-3d` | Só `lead_events.type='auto:followup-3d'` (sem tag/sem move) | event lookup do dia |
| **24h follow-up** | else if `last_human_activity_at < now()-24h` | Só `lead_events.type='auto:followup-24h'` | event lookup do dia |

> **Pegada**: tiers 24h e 3d **não** geram mensagens nem moves — são apenas marcações temporais para humanos/UI. A geração de mensagens vive em `/automations` (sistema separado).
>
> O tier de 60d roda no **mesmo cron** `pipeline-inactivity-tick` (a cada 15 min), em **branch independente** dos tiers 24h/3d/7d. Toggle separado: `automation.inactivity_paciente_antigo.enabled`.

### `auto:monthly-sweep` (cron `0 3 1 * *` — Dia 1 às 00h Brasília)

Sweep mensal que aposenta cards de "Consulta finalizada" e "1ª Sessão Finalizada" do mês anterior, movendo-os em massa para "Paciente antigo".

- **Disparo**: cron PG `pipeline-monthly-sweep-paciente-antigo` chama `POST /pipeline-deterministic` com `{"action":"monthly-sweep-tick"}`. Cadência: dia 1 de cada mês, 03h UTC = 00h Brasília.
- **Toggle**: `automation.monthly_sweep_paciente_antigo.enabled` (default **false** — precisa ser ligado manualmente em `app_settings` após validar com dry-run).
- **Stages de origem**: aliases canônicos `Consulta finalizada` e `1ª Sessão Finalizada`.
- **Stage destino**: alias canônico `Paciente antigo` (resolvido por pipeline).
- **Filtro**: `stage_changed_at < primeiro dia do mês corrente (UTC)`, `archived_at IS NULL`, `is_internal_contact=false`, limit 5000.
- **Efeito por lead movido**:
  1. `pipelineMove(... source='auto:monthly-sweep', idempotencyKey='monthly-sweep:<leadId>:<YYYY-MM>')`.
  2. Patch `custom_fields.eh_paciente_antigo=true`.
  3. `lead_events.type='auto:monthly-sweep'` com `{ym, from_stage_id, to_stage_id}`.
- **Idempotência**: a key mensal garante que rodar o cron 2× no mesmo mês não duplica o move.
- **Retorno**: `{ym, dryRun, moved, scanned, sample}` (até 20 itens em `sample`).

#### Payload aceito

```json
{
  "action": "monthly-sweep-tick",
  "dry_run": false
}
```

- `dry_run: true` ignora o toggle, **não** chama `pipelineMove`, **não** grava custom_fields/eventos, e devolve apenas a contagem + amostra do que seria movido.
- `dry_run` omitido ou `false`: respeita o toggle (`skipped: "toggle_off"` se desligado) e executa de fato.

#### Como rodar dry-run manualmente

```ts
// no console do app (logado como admin), ou via curl autenticado
await supabase.functions.invoke('pipeline-deterministic', {
  body: { action: 'monthly-sweep-tick', dry_run: true },
});
// → { ok: true, result: { ym: '2026-06', dryRun: true, moved: N, scanned: M, sample: [...] } }
```

Para ativar de verdade depois de validar:

```sql
UPDATE public.app_settings
SET value = 'true'::jsonb
WHERE key = 'automation.monthly_sweep_paciente_antigo.enabled';
```

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

## Transição Agendamento Humano (Junho/2026)

A IA não pode mais mover cards para os estágios de agendamento/finalização. As regras determinísticas mudaram assim:

- **`ruleFieldChanged` — novos gatilhos manuais (Fase 3 / código atual em `pipeline-deterministic/index.ts`):**
  - `consulta_agendada_em` preenchido pela secretária → move para `Consulta agendada` (`auto:field-changed-consulta`).
  - `procedimento_agendado_em` preenchido → move para `Tratamento agendado` (`auto:field-changed-procedimento`).
  - Idempotência: `field-changed-(consulta|procedimento):{lead_id}:{ISO_data}`.
  - Toggle: `automation.appointment_sync.enabled` (deve estar `true`).
- **`ruleConsultaPassou` — DESLIGADA.** Retorna `{ skipped: "disabled_by_human_transition" }` antes de qualquer leitura. Com múltiplos procedimentos paralelos por paciente (ex.: psiquiatria + cetamina) o cron derrubava cards ativos. Finalização é manual (secretária move o card).
- **Classifier (`apply.ts`)**: datas de agendamento detectadas pelo parser são logadas em `fields_rejected` com `reason: ai_scheduling_disabled_by_human_transition` em vez de aplicadas; sugestões de stage para `Consulta agendada`, `Tratamento agendado`, `Consulta finalizada` ou `1ª Sessão Finalizada` são rejeitadas no general move com o mesmo motivo.
- **Auditor A1 (`pipeline-position-auditor`)**: prompt proíbe sugerir esses 4 estágios.

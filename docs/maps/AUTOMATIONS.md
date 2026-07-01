---
title: "Mapa — Automations (regras condicionais no CRM)"
topic: automations
kind: map
audience: agent
updated: 2026-07-01
summary: "Motor de regras condicionais rodando via cron a cada 5min. 3 triggers (no_reply_after, stage_idle, before_appointment) × 3 actions (ai_followup, move_stage, send_template) com cooldown, filtros por stage/pipeline, condition por custom field e proteção de agenda no mesmo dia."
code_refs:
  - supabase/functions/automations-tick/
  - src/pages/Automations.tsx
  - supabase/functions/_shared/automations-paused.ts
  - supabase/functions/_shared/template-vars.ts
related_docs:
  - docs/maps/SEQUENCES.md
  - docs/maps/TEMPLATES.md
  - docs/maps/PIPELINE_RUNTIME.md
  - docs/Fluxo-atual.md
---

# Automations — Regras condicionais

Motor determinístico que dispara ações baseadas em atributos do lead. Distinto de:
- **Sequences** (`message_sequences`) — cadência linear de mensagens.
- **Pipeline runtime** (`pipeline-deterministic`) — regras de movimentação por evento.

## 1. Tabela `automations` (12 col)

Campos: `name`, `description`, `enabled`, `clinic_id`, `trigger_type`, `trigger_config` (jsonb), `action_type`, `action_config` (jsonb), `cooldown_hours`.

Auditoria: `automation_runs` (8 col) — `automation_id`, `lead_id`, `clinic_id`, `status` (`success|error|skipped`), `detail`, `appointment_at`, `created_at`.

## 2. Triggers (3)

### `no_reply_after`
Config: `{ hours, stage_ids?[], stage_id? }`. Busca leads com `last_message_at <= now - hours` na(s) coluna(s) e verifica se a última mensagem é **inbound** (`from_me=false`). Filtra `archived_at IS NULL`.

### `stage_idle`
Config: `{ hours, stage_ids?[], stage_id? }`. Leads com `stage_changed_at <= now - hours` na(s) coluna(s).

### `before_appointment`
Config completa:
```json
{
  "field_key": "consulta_at",
  "offset_minutes": 60,
  "tz": "America/Sao_Paulo",
  "preferred_time": "10:00",
  "business_hours_only": true,
  "business_hours_start": 10,
  "business_hours_end": 22,
  "stage_id": "…",
  "condition": { "field_key": "teleconsulta", "op": "eq|neq|empty|not_empty", "value": "sim" }
}
```

Lógica:
- Janela: `now >= appt - offset` e `now <= appt - 5min`.
- `preferred_time` (ex.: "10:00" para D-1): só dispara depois dessa hora local **e** no mesmo dia local do target.
- `business_hours_only`: bloqueia fora do horário/weekend.
- **Bloqueio same-day**: se `leads.updated_at` (proxy de "agendado hoje") cai no mesmo dia da consulta:
  - `offset_minutes >= 360` (D-1 e maiores): **skip** — evita lembrete retroativo para agendamento de última hora.
  - Menor offset: só dispara se `hoursToAppt > 5`.
- `condition`: filtro por outro custom field com normalização booleana (`sim/nao` = `true/false/1/0/yes/no/y/n`).

## 3. Actions (3)

### `ai_followup`
Config: `{ agent_id, prompt? }`. Fetcha últimas 20 msgs → chama `ai-chat` (persist=true) com instrução interna → `evolution-send` do resultado.

### `move_stage`
Config: `{ stage_id }`. Chama `pipelineMove()` shared helper com `source='auto:automation-rule'` — passa por gates G1–G5/G8, respeita `lock_auto_move`, grava `lead_stage_history`, idempotência por `automation:{id}:{leadId}:{stageId}`.

### `send_template`
Config: `{ template_id }`. Renderiza `message_templates.content` via `renderTemplate()` com `lead + custom_field_defs + clinic_tz`, envia via `evolution-send`.

## 4. Cooldown & anti-duplicação

- `recentlyRan()` — checa `automation_runs.status='success'` nas últimas `cooldown_hours`.
- **Piso defensivo**: `cooldown_hours >= 1` sempre; para `before_appointment`, `>= ceil(offset_h * 1.5)`.
- Para `before_appointment`, `shouldSkipForAppointment()` compara `automation_runs.appointment_at`: se a data mudou (reagendamento), libera; se igual, bloqueia.
- Runs antigos sem `appointment_at` são tratados como cooldown ativo (evita broadcast retroativo após deploy).

## 5. Segurança

- **Cross-clinic guard**: se `lead.clinic_id != automation.clinic_id`, skip com warning.
- **Automations paused** (`_shared/automations-paused.ts`): flag global por clínica que pausa TODAS as automações + sequences + scheduled dispatchers. Usado em manutenção/incidents.
- Cron pg_cron a cada 5min chama `automations-tick` sem Bearer (`verify_jwt=false`).

## 6. Frontend — `src/pages/Automations.tsx` (597 LOC)

Editor com 3 abas por automação: Trigger, Action, Histórico (`automation_runs` recentes). Sidebar "Minimalista SaaS" listando automações. Suporta `Play` para rodar ad-hoc (chama `automations-tick` via edge).

## 7. Invariantes

1. Nunca disparar antes de checar `cross-clinic` + `automations-paused`.
2. `before_appointment` requer `field_key` (senão retorna []).
3. `move_stage` **sempre** via `pipelineMove()` — nunca `UPDATE leads.stage_id` direto.
4. `recentlyRan` filtra por `status='success'` — erros não bloqueiam retry no próximo tick.
5. Registrar `appointment_at` em todo run (mesmo `skipped`) — usado por `shouldSkipForAppointment`.
6. Cooldown mínimo defensivo é aplicado no código, não confia no que veio da UI.

## 8. Débitos técnicos

- `findCandidates` faz N+1 query em `no_reply_after` (busca last message por lead).
- Limite fixo de 50 leads por trigger por tick — pode subestimar em bases grandes.
- Sem UI de rerun/backfill de automation.
- `trigger_config.condition` só suporta 1 filtro — não há AND/OR de múltiplos campos.

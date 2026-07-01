---
title: "Mapa — Sequences (cadência linear de mensagens)"
topic: automations
kind: map
audience: agent
updated: 2026-07-01
summary: "message_sequences: cadência linear com N steps (delay_minutes cumulativo + send_window). Triggers: stage_enter/pipeline_enter (DB trigger), webhook (público via public_token), manual (sequence-enroll). Motor: sequence-tick cron 1min."
code_refs:
  - supabase/functions/sequence-tick/
  - supabase/functions/sequence-enroll/
  - supabase/functions/sequence-trigger/
  - src/pages/Sequences.tsx
related_docs:
  - docs/maps/AUTOMATIONS.md
  - docs/maps/TEMPLATES.md
  - docs/maps/EVOLUTION_EDGES.md
---

# Sequences — Cadência de mensagens

Sequência linear de N mensagens com delays entre elas. Cada lead pode ter no máximo 1 enrollment ativo por sequência (respeitando `cooldown_days`).

## 1. Modelo de dados

| Tabela | Papel |
|---|---|
| `message_sequences` (13 col) | `name`, `enabled`, `trigger_type` (`stage_enter\|pipeline_enter\|webhook\|manual`), `trigger_config`, `whatsapp_instance_id` (override opcional), `stop_on_reply`, `cooldown_days`, `public_token` (para trigger webhook). |
| `message_sequence_steps` (9 col) | `position`, `delay_minutes` (relativo ao step anterior), `template_id` OU `content` inline, `send_window` (jsonb: `{timezone, start_hour, end_hour, weekdays[]}`). |
| `message_sequence_enrollments` (10 col) | `sequence_id`, `lead_id`, `status` (`active\|completed\|canceled\|failed`), `current_step`, `next_run_at`, `started_at`, `ended_at`, `source` (jsonb). |
| `message_sequence_runs` (11 col) | Audit por step enviado: `status` (`sent\|failed\|skipped`), `stage_id_at_send`, `stage_position_at_send` (snapshot). |

## 2. Triggers

### `stage_enter` / `pipeline_enter` — via DB trigger
Migration `20260514184150…` cria trigger em `leads` que insere enrollment automaticamente quando `stage_id` muda para uma coluna alvo. Config: `{ stage_ids?[], pipeline_id? }`.

### `webhook` — `sequence-trigger` (129 LOC)
Endpoint público (`verify_jwt=false`). Body: `{ token, phone, name?, email?, tags?, metadata? }`.
- Resolve sequência por `public_token`. Erro 404 se inválido/desabilitado ou não `trigger_type='webhook'`.
- Sanitiza phone (só dígitos, min 8).
- Busca ou cria lead na `clinic_id` da sequência (pipeline default sales + primeira stage).
- Se lead existia, faz patch de `name/email` faltantes e append de tags únicas.
- Cooldown por sequência: se enrollment ativo dentro de `cooldown_days`, retorna `deduped:true`.
- Cria enrollment com `source: { trigger:'webhook', metadata }`.

### `manual` — `sequence-enroll` (45 LOC)
UI chama com Bearer JWT + `{ sequence_id, lead_id }`. Valida que `lead.clinic_id == sequence.clinic_id`, aplica cooldown, cria enrollment com `source: { trigger:'manual', actor: userId }`.

## 3. Motor — `sequence-tick` (190 LOC)

Cron cada 1min. Fluxo:
1. Filtra clínicas pausadas (`getPausedClinicIds`).
2. Fetcha até 50 enrollments `active` com `next_run_at <= now`.
3. Para cada:
   - Carrega `sequence + steps + lead + custom_field_defs`.
   - Snapshot `stage_id/position` do lead (para audit).
   - Se sequência desabilitada → cancela enrollment.
   - Se sem lead → `failed`.
   - Se `step` não existe (fim) → `completed`.
   - **Send window** (`inSendWindow`): fora → empurra `next_run_at + 30min`.
   - Resolve texto: `step.template_id` OU `step.content` inline. Vazio → `skipped` + advance.
   - Renderiza via `renderTemplate()` (mesma func do template-vars).
   - Se `sequence.whatsapp_instance_id` e lead sem instância, patch idempotente (`.is(instance, null)`).
   - Chama `evolution-send`.
     - OK → run `sent`, agenda próximo step (`now + nextStep.delay_minutes`).
     - Falha → run `failed`. Retry em 15min. Após 3 falhas do MESMO step → enrollment `failed`.

## 4. Frontend — `src/pages/Sequences.tsx` (508 LOC)

- Editor com abas: Configuração, Steps, Enrollments (histórico).
- Reordenação de steps por drag/arrow.
- Preview do rendered content por lead selecionado.
- UI de `public_token` (copiável) quando trigger=webhook. **Nunca expor este token em conta de usuário sem permissão** — column-level security já limita a leitura.
- Botão "Rodar agora" chama sequence-tick ad-hoc.

## 5. Stop on reply

Flag `sequence.stop_on_reply`. Quando lead responde (mensagem inbound), lógica externa em `pipeline-deterministic` ou trigger em `messages` deve cancelar enrollments ativos com esta flag. (Ver `docs/pipeline/runtime/*` para o gatilho exato.)

## 6. Invariantes

1. Cooldown por lead+sequência é **obrigatório** (previne re-enrollment infinito por trigger).
2. `send_window` é avaliado no timezone do próprio window (fallback: `clinics.timezone`).
3. Snapshot de stage (`stage_id_at_send`) é gravado no `runs`, não no `enrollments` — permite avaliar mudanças ao longo da cadência.
4. `whatsapp_instance_id` da sequência só sobrescreve o do lead se este for NULL — não roubar instância de lead já vinculado.
5. `public_token` é secret — column-level security já restringe.
6. Nunca deletar enrollment ativo — sempre `status='canceled'`.

## 7. Débitos técnicos

- Não há UI para pausar enrollment individual (só cancel).
- `stop_on_reply` só funciona se o handler em `pipeline-deterministic` estiver online — falta trigger DB de segurança.
- Retry por step conta falhas via `message_sequence_runs` (query extra a cada erro).
- Sem paralelismo — 50 enrollments/min é o teto.

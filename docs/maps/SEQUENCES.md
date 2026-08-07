---
title: "Mapa â€” Sequences (cadÃªncia linear de mensagens)"
topic: automations
kind: map
audience: agent
updated: 2026-07-01
summary: "message_sequences: cadÃªncia linear com N steps (delay_minutes cumulativo + send_window). Triggers: stage_enter/pipeline_enter (DB trigger), webhook (pÃºblico via public_token), manual (sequence-enroll). Motor: sequence-tick cron 1min."
code_refs:
  - supabase/functions/sequence-tick/
  - supabase/functions/sequence-enroll/
  - supabase/functions/sequence-trigger/
  - src/pages/Sequences.tsx
related_docs:
  - docs/maps/AUTOMATIONS.md
  - docs/maps/TEMPLATES.md
  - docs/evolution/EVOLUTION_EDGES.md
---

# Sequences â€” CadÃªncia de mensagens

SequÃªncia linear de N mensagens com delays entre elas. Cada lead pode ter no mÃ¡ximo 1 enrollment ativo por sequÃªncia (respeitando `cooldown_days`).

## 1. Modelo de dados

| Tabela | Papel |
|---|---|
| `message_sequences` (13 col) | `name`, `enabled`, `trigger_type` (`stage_enter\|pipeline_enter\|webhook\|manual`), `trigger_config`, `whatsapp_instance_id` (override opcional), `stop_on_reply`, `cooldown_days`, `public_token` (para trigger webhook). |
| `message_sequence_steps` (9 col) | `position`, `delay_minutes` (relativo ao step anterior), `template_id` OU `content` inline, `send_window` (jsonb: `{timezone, start_hour, end_hour, weekdays[]}`). |
| `message_sequence_enrollments` (10 col) | `sequence_id`, `lead_id`, `status` (`active\|completed\|canceled\|failed`), `current_step`, `next_run_at`, `started_at`, `ended_at`, `source` (jsonb). |
| `message_sequence_runs` (11 col) | Audit por step enviado: `status` (`sent\|failed\|skipped`), `stage_id_at_send`, `stage_position_at_send` (snapshot). |

## 2. Triggers

### `stage_enter` / `pipeline_enter` â€” via DB trigger
Migration `20260514184150â€¦` cria trigger em `leads` que insere enrollment automaticamente quando `stage_id` muda para uma coluna alvo. Config: `{ stage_ids?[], pipeline_id? }`.

### `webhook` â€” `sequence-trigger` (129 LOC)
Endpoint pÃºblico (`verify_jwt=false`). Body: `{ token, phone, name?, email?, tags?, metadata? }`.
- Resolve sequÃªncia por `public_token`. Erro 404 se invÃ¡lido/desabilitado ou nÃ£o `trigger_type='webhook'`.
- Sanitiza phone (sÃ³ dÃ­gitos, min 8).
- Busca ou cria lead na `clinic_id` da sequÃªncia (pipeline default sales + primeira stage).
- Se lead existia, faz patch de `name/email` faltantes e append de tags Ãºnicas.
- Cooldown por sequÃªncia: se enrollment ativo dentro de `cooldown_days`, retorna `deduped:true`.
- Cria enrollment com `source: { trigger:'webhook', metadata }`.

### `manual` â€” `sequence-enroll` (45 LOC)
UI chama com Bearer JWT + `{ sequence_id, lead_id }`. Valida que `lead.clinic_id == sequence.clinic_id`, aplica cooldown, cria enrollment com `source: { trigger:'manual', actor: userId }`.

## 3. Motor â€” `sequence-tick` (190 LOC)

Cron cada 1min. Fluxo:
1. Filtra clÃ­nicas pausadas (`getPausedClinicIds`).
2. Fetcha atÃ© 50 enrollments `active` com `next_run_at <= now`.
3. Para cada:
   - Carrega `sequence + steps + lead + custom_field_defs`.
   - Snapshot `stage_id/position` do lead (para audit).
   - Se sequÃªncia desabilitada â†’ cancela enrollment.
   - Se sem lead â†’ `failed`.
   - Se `step` nÃ£o existe (fim) â†’ `completed`.
   - **Send window** (`inSendWindow`): fora â†’ empurra `next_run_at + 30min`.
   - Resolve texto: `step.template_id` OU `step.content` inline. Vazio â†’ `skipped` + advance.
   - Renderiza via `renderTemplate()` (mesma func do template-vars).
   - Se `sequence.whatsapp_instance_id` e lead sem instÃ¢ncia, patch idempotente (`.is(instance, null)`).
   - Chama `evolution-send`.
     - OK â†’ run `sent`, agenda prÃ³ximo step (`now + nextStep.delay_minutes`).
     - Falha â†’ run `failed`. Retry em 15min. ApÃ³s 3 falhas do MESMO step â†’ enrollment `failed`.

## 4. Frontend â€” `src/pages/Sequences.tsx` (508 LOC)

- Editor com abas: ConfiguraÃ§Ã£o, Steps, Enrollments (histÃ³rico).
- ReordenaÃ§Ã£o de steps por drag/arrow.
- Preview do rendered content por lead selecionado.
- UI de `public_token` (copiÃ¡vel) quando trigger=webhook. **Nunca expor este token em conta de usuÃ¡rio sem permissÃ£o** â€” column-level security jÃ¡ limita a leitura.
- BotÃ£o "Rodar agora" chama sequence-tick ad-hoc.

## 5. Stop on reply

Flag `sequence.stop_on_reply`. Quando lead responde (mensagem inbound), lÃ³gica externa em `pipeline-deterministic` ou trigger em `messages` deve cancelar enrollments ativos com esta flag. (Ver `docs/pipeline/runtime/*` para o gatilho exato.)

## 6. Invariantes

1. Cooldown por lead+sequÃªncia Ã© **obrigatÃ³rio** (previne re-enrollment infinito por trigger).
2. `send_window` Ã© avaliado no timezone do prÃ³prio window (fallback: `clinics.timezone`).
3. Snapshot de stage (`stage_id_at_send`) Ã© gravado no `runs`, nÃ£o no `enrollments` â€” permite avaliar mudanÃ§as ao longo da cadÃªncia.
4. `whatsapp_instance_id` da sequÃªncia sÃ³ sobrescreve o do lead se este for NULL â€” nÃ£o roubar instÃ¢ncia de lead jÃ¡ vinculado.
5. `public_token` Ã© secret â€” column-level security jÃ¡ restringe.
6. Nunca deletar enrollment ativo â€” sempre `status='canceled'`.

## 7. DÃ©bitos tÃ©cnicos

- NÃ£o hÃ¡ UI para pausar enrollment individual (sÃ³ cancel).
- `stop_on_reply` sÃ³ funciona se o handler em `pipeline-deterministic` estiver online â€” falta trigger DB de seguranÃ§a.
- Retry por step conta falhas via `message_sequence_runs` (query extra a cada erro).
- Sem paralelismo â€” 50 enrollments/min Ã© o teto.

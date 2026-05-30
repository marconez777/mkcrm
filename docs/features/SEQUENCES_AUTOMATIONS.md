# Sequences & Automations

> Dois motores complementares de follow‑up automatizado:
>
> - **Sequences** — drip campaigns de N passos com delay configurável,
>   acionadas manual/webhook/trigger de estágio.
> - **Automations** — regras event‑driven mais leves (sem múltiplos passos),
>   baseadas em condições periódicas (no_reply_after, stage_idle,
>   before_appointment).
>
> Última atualização: 2026‑05‑30

---

## 1. Sequences (drip / cadências)

### 1.1 Modelo de dados

| Tabela                              | Papel                                                                              |
|-------------------------------------|------------------------------------------------------------------------------------|
| `message_sequences`                 | Cabeçalho: `enabled`, `trigger_type` (`manual|webhook|stage_change|pipeline_enter`), `cooldown_days`, `whatsapp_instance_id`, `stop_on_reply`, `public_token`. |
| `message_sequence_steps`            | Passos ordenados por `position`. Conteúdo inline (`content`) ou via `template_id`. `delay_minutes`, `send_window`. |
| `message_sequence_enrollments`      | Inscrição lead↔sequence: `status` (`active|paused|completed|canceled|failed`), `current_step`, `next_run_at`, `source` (jsonb). |
| `message_sequence_runs`             | Log por execução de step: `status` (`sent|failed|skipped`), `detail`, **`replied_at`** (timestamp da primeira resposta do lead após este envio) e snapshot **`stage_id_at_send`** / **`stage_position_at_send`** (estágio do lead no momento do envio). Consumidos pelas RPCs `engagement_sequences_summary` / `engagement_sequence_steps` — ver [`docs/features/ENGAGEMENT.md`](./ENGAGEMENT.md). |

### 1.2 Triggers

- **`manual`** — UI chama `supabase/functions/sequence-enroll`
  (`POST { sequence_id, lead_id }`). Requer JWT, valida cooldown.
- **`webhook`** — endpoint público `supabase/functions/sequence-trigger`
  (`POST { token, phone, name?, email?, tags?, metadata? }`). Resolve a
  sequência pelo `public_token`, cria/atualiza lead na clínica do token,
  aplica cooldown, cria enrollment. Sem JWT — segurança é o token.
- **Trigger DB (`stage_change`)** — trigger em `leads` cria enrollment quando o lead **muda** para o `stage_id` configurado em `message_sequences.trigger_config`.
- **Trigger DB (`pipeline_enter`)** — adicionado em 2026‑05‑28. Cria enrollment quando o lead **entra no pipeline pela primeira vez** (independente de mudança subsequente de estágio). Útil para "boas-vindas" sem disparar em moves laterais. Ver `docs/database/FUNCTIONS_TRIGGERS.md`.

### 1.3 Worker (`sequence-tick`)

Cron pg_cron a cada minuto. Pega até **50 enrollments** com `status='active'`
e `next_run_at <= now()`.

Para cada enrollment:
1. Carrega `sequence`, `steps[]`, `lead`.
2. Se `sequence.enabled=false` → `canceled`.
3. Sem step no `current_step` → `completed`.
4. **Send window** (`step.send_window`): fora da janela → empurra
   `next_run_at` em 30 minutos.
5. Resolve `text` (`step.content` ou `template.content`); vazio → log
   `skipped` e avança step.
6. Renderiza variáveis: `{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`,
   `{{email}}`, `{{empresa}}`.
7. Override de instância: se `sequence.whatsapp_instance_id` e o lead não
   tem instância, faz `UPDATE leads SET whatsapp_instance_id = ?
   WHERE id=? AND whatsapp_instance_id IS NULL`.
8. Chama `evolution-send` (service role) com `client_message_id = uuid()`.
9. **Sucesso** → log `sent`, agenda próximo step com
   `next_run_at = now() + step.delay_minutes`. Sem próximo step → `completed`.
10. **Falha** → log `failed`. Conta falhas do mesmo step para o mesmo
    enrollment; **≥3 falhas** → enrollment `failed`. Caso contrário, retenta
    em **15 minutos**.

### 1.4 `stop_on_reply`

Se `message_sequences.stop_on_reply=true`, o ingest de mensagens inbound
(`_shared/evolution.ts::ingestMessage` ou trigger DB) marca enrollments
ativos do lead como `paused`/`completed` para não enviar follow‑ups após
o lead responder. Detalhe da implementação em
[`docs/edge-functions/SHARED_HELPERS.md`](../edge-functions/SHARED_HELPERS.md).

### 1.5 Frontend

- `src/pages/Sequences.tsx` — CRUD de sequências, steps, preview de variáveis.
- LeadDrawer → "Enrolar em sequência" usa `sequence-enroll`.

---

## 2. Automations (regras event‑driven)

### 2.1 Modelo de dados

| Tabela            | Papel                                                                  |
|-------------------|------------------------------------------------------------------------|
| `automations`     | `enabled`, `trigger_type`, `trigger_config` (jsonb), `action_type`, `action_config`, `cooldown_hours`. |
| `automation_runs` | Log: `status` (`success|error`), `detail`.                             |

### 2.2 Triggers suportados (`automations-tick`)

| `trigger_type`          | `trigger_config`                                                                 | Lógica                                                                                                  |
|-------------------------|----------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `no_reply_after`        | `{ hours, stage_id? }`                                                           | Leads com `last_message_at <= now()-h` cuja **última msg foi inbound** (`from_me=false`).               |
| `stage_idle`            | `{ hours, stage_id }`                                                            | Leads parados no `stage_id` há mais de N horas (`stage_changed_at`).                                    |
| `before_appointment`    | `{ field_key, offset_minutes, tz, preferred_time?, business_hours_only?, stage_id? }` | Lead com `custom_fields[field_key]` (data) onde `now ∈ [target, appt-5min]`, com filtros de janela.    |

### 2.3 Ações suportadas (`runAction`)

| `action_type`     | `action_config`                                                       | Comportamento                                                                                |
|-------------------|-----------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| `ai_followup`     | `{ agent_id, prompt? }`                                               | Carrega 20 últimas msgs, chama `ai-chat` com instrução interna, envia via `evolution-send`.  |
| `move_stage`      | `{ stage_id }`                                                        | `UPDATE leads SET stage_id=? WHERE id=?`.                                                    |
| `send_template`   | `{ template_id }`                                                     | Renderiza variáveis do `message_templates.content` e envia.                                  |

### 2.4 Cooldown

`recentlyRan(automation_id, lead_id, cooldown_hours)` consulta
`automation_runs.status='success'` no intervalo; se houve, pula com
`skipped++`.

### 2.5 Cron

Default: a cada 5 minutos (pg_cron). Cada execução varre **todas as**
automations habilitadas → busca candidatos → aplica cooldown → executa
ação → loga.

### 2.6 Frontend

`src/pages/Automations.tsx` — editor de regra (trigger + condições + ação),
toggle enabled, log de runs.

---

## 3. Email Automations

Análogo a Automations, mas para email. Worker: `email-automations-tick`.
Veja [`docs/edge-functions/EMAIL.md`](../edge-functions/EMAIL.md) para o
fluxo completo (segmentos, templates, fila de envio via Resend).

---

## 4. Erros comuns / troubleshooting

| Sintoma                                                | Causa / fix                                                                            |
|--------------------------------------------------------|----------------------------------------------------------------------------------------|
| Enrollment fica preso em `active`                      | `next_run_at` futuro (delay) ou cron parado. Conferir `pg_cron.job` p/ `sequence-tick`. |
| Sequence dispara fora do horário                       | `step.send_window` ausente ou tz errado.                                               |
| Falha repetida com "ai-chat 429"                       | `spend-guard` bloqueou (ver `docs/architecture/FEATURE_FLAGS.md`). Ajustar limite.     |
| Variável `{{nome}}` não renderiza                      | Lead sem `name`; verificar fallback ou usar `{{primeiro_nome}}` cuidadosamente.        |
| Automation `before_appointment` não dispara            | `custom_fields[field_key]` precisa ser ISO parseável; `preferred_time` exige `HH:MM` 24h. |
| Automation dispara em loop                             | `cooldown_hours` zero ou run nunca marcada `success`. Conferir `automation_runs`.      |
| Sequence pula step com `skipped: empty content`        | Template deletado ou `content` vazio. Recriar.                                         |

---

## 5. Limitações / melhorias futuras

- **Sequences**: não suporta branches/condicionais (if/else) entre steps.
  Hoje é linear. Para condicional, criar duas sequências e usar
  `stop_on_reply` + trigger de estágio.
- **Sequences**: não suporta mídia (apenas texto via `evolution-send`).
- **Automations**: lista de triggers/actions é hard‑coded em `automations-tick`.
  Adicionar novos requer deploy. Considerar tabela `automation_actions_registry`.
- **Sem dry‑run**: testar uma automation hoje exige criar lead real ou
  esperar candidatos. Adicionar "simular" no UI.
- **Métricas**: agregação de `automation_runs` / `message_sequence_runs`
  vive apenas em queries ad‑hoc. Considerar materialized view diária.
- **Concorrência**: `sequence-tick` processa em série dentro de um tick
  (limit 50). Em scale grande, pode atrasar. Considerar particionar por
  `clinic_id`.

---

## 6. Links

- Schema: [`docs/database/SCHEMA.md`](../database/SCHEMA.md).
- Triggers DB (`messages` → `message_sequence_enrollments`): [`docs/database/FUNCTIONS_TRIGGERS.md`](../database/FUNCTIONS_TRIGGERS.md).
- AI helpers: [`docs/edge-functions/AI.md`](../edge-functions/AI.md).
- Email automations: [`docs/edge-functions/EMAIL.md`](../edge-functions/EMAIL.md).

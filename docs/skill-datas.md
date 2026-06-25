---
title: "Skill — Datas, Agendamentos, Lembretes e Custom Fields"
topic: automations
kind: reference
audience: agent
updated: 2026-06-25
summary: "Mapa profundo de tudo que envolve datas, agendamento de consulta/procedimento, lembretes automáticos e campos personalizados de lead — modelo de dados, frontend, edge functions, regras determinísticas, regras da IA pós-transição humana e variáveis de template."
code_refs:
  - src/pages/Automations.tsx
  - src/pages/SettingsCustomFields.tsx
  - src/pages/SettingsAppointmentTypes.tsx
  - src/components/inbox/CustomFieldsPanel.tsx
  - src/components/kanban/calendar/PipelineCalendar.tsx
  - src/components/kanban/calendar/AppointmentDialog.tsx
  - src/hooks/useAppointments.ts
  - src/hooks/useCustomFieldDefs.ts
  - src/hooks/useServiceTypes.ts
  - src/lib/appointments-mutations.ts
  - src/lib/service-types-mutations.ts
  - src/lib/template-vars.ts
  - supabase/functions/automations-tick/
  - supabase/functions/sequence-tick/
  - supabase/functions/pipeline-deterministic/
  - supabase/functions/pipeline-classify/
  - supabase/functions/pipeline-position-auditor/
  - supabase/functions/_shared/template-vars.ts
  - supabase/functions/_shared/dates.ts
  - supabase/functions/_shared/pipeline-move.ts
related_docs:
  - docs/pipeline/CALENDAR.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
  - docs/pipeline/AUTOMATION_PLAN.md
  - docs/pipeline/runtime/USER_AUTOMATIONS.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/runtime/FIELDS_LIVE.md
  - docs/pipeline/runtime/STAGES_LIVE.md
  - docs/pipeline/runtime/FLOW_MATRIX.md
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
  - docs/estudo/03-consulta-agendada.md
  - docs/estudo/05-consulta-finalizada.md
  - docs/estudo/10-procedimento-agendado.md
  - docs/estudo/13-antigo-consultaprocedimento-agendado.md
  - docs/estudo/clinica-or-fluxo-novo.md
---

# Skill — Datas, Agendamentos, Lembretes e Custom Fields

Documento-mapa para qualquer adaptação futura nessa área. Tudo abaixo é o que
hoje está em produção. Referências `file:line` apontam para o ponto exato.

---

## 1. Princípio em vigor (Junho/2026)

**Transição "Agendamento 100% Humano"** — toda a movimentação de cards entre
estágios de agendamento/finalização passou a ser **manual** (secretária).
A IA detecta intenção e datas, mas:

- **Não preenche** `consulta_agendada_em` nem `procedimento_agendado_em`
  (`HUMAN_SCHEDULING_FIELDS` em `supabase/functions/pipeline-classify/apply.ts:27-30`).
- **Não move** para `Consulta agendada`, `Tratamento agendado`,
  `Consulta finalizada`, `1ª Sessão Finalizada`
  (`HUMAN_SCHEDULING_STAGES` em `apply.ts:31-36`).
- Reject reason canônico: `ai_scheduling_disabled_by_human_transition`
  (`apply.ts:37`).

Prompts que reforçam a trava:
- Movimentador: `supabase/functions/pipeline-classify/agent-core.ts:525-528`.
- Auditor A1: `supabase/functions/pipeline-position-auditor/index.ts:143-145`.

Quem efetivamente move:
- **Secretária** via UI (Kanban / Inbox / Calendário) preenche a data nos
  custom fields → o trigger determinístico `auto:field-changed-consulta` /
  `auto:field-changed-procedimento` move o card
  (`supabase/functions/pipeline-deterministic/index.ts:488-522`).
- **Tabela `appointments`** (Calendário) com `status='agendado'` aciona
  `auto:appointment-sync` (`pipeline-deterministic/index.ts:298-407`).
- O cron `ruleConsultaPassou` está **desligado** desde a transição
  (`pipeline-deterministic/index.ts:761-766`).

---

## 2. Glossário rápido

### Campos de data (em `leads.custom_fields` jsonb)

| Chave | Tipo | Quem grava | Quem lê |
|---|---|---|---|
| `consulta_agendada_em` | `datetime` ISO | Secretária (UI) ou `auto:appointment-sync` (a partir de `appointments`) | Mover stage, lembretes `before_appointment`, templates |
| `procedimento_agendado_em` | `datetime` ISO | Idem | Idem |
| `pagamento_alegado_em` | `datetime` | IA (Tipificador) + UI | Auditor, relatórios |
| `data_solicitacao_nf` | `datetime` | IA + UI | Auditor |

Listadas em `DATE_FIELD_KEYS` (`schema.ts:69-72`). As duas primeiras estão
também em `HUMAN_SCHEDULING_FIELDS` — IA detecta mas não grava.

### Colunas de data em `public.leads` (não custom_fields)

`last_message_at`, `last_inbound_at`, `last_human_activity_at`,
`stage_changed_at`, `last_classified_at`, `last_site_activity_at`,
`ai_review_queued_at`, `manual_lock_until`, `pinned_at`, `archived_at`,
`created_at`, `updated_at`, `ai_summary_at`.

### Estágios envolvidos

`Novo`, `Qualificação`, `Consulta agendada`, `Tratamento agendado`,
`Consulta finalizada`, `1ª Sessão Finalizada`, `Sem resposta`,
`Nutrição inativa`, `Nutrição Antigos`, `Paciente antigo`,
`B2B / Stakeholders`, `Desqualificado`.

Canonicalizados em `supabase/functions/pipeline-classify/schema.ts:6-32`.
Resolução por clínica via `stage_canonical_aliases`
(`pipeline-deterministic/index.ts:64-89`).

---

## 3. Modelo de dados

### 3.1 `leads` (48 colunas)

`custom_fields` (jsonb) guarda todos os valores de campos personalizados.
A escrita pode ocorrer por:

- UI (inbox `CustomFieldsPanel.tsx:28`, kanban, etc.) — UPDATE direto.
- RPC `apply_lead_automation_patch` (chamada pelo Classifier
  `apply.ts:270-279`) — atualiza `custom_fields` + `tags` atomicamente sem
  disparar G10.
- Função `patchCustomFields` em `pipeline-deterministic/index.ts:102-114`
  (merge superficial).

Triggers em `leads`:
- `trg_track_custom_fields_human_edits` — popula `custom_fields_last_human_edit`
  (jsonb timestamp por chave) usada pelo G10
  (`supabase/migrations/20260618151428_*.sql:52-53`).
- `trg_validate_lead_custom_fields_enums` — valida valores de campos
  `select`/`multiselect` contra `lead_custom_fields.options`
  (`20260614225820_*.sql:77-78`).
- `trg_leads_auto_field_changed` — notifica `pipeline-deterministic` action
  `field-changed` quando `custom_fields IS DISTINCT FROM`
  (`20260618022933_*.sql:155-158`).

### 3.2 `appointments` (12 colunas)

```
id, clinic_id, lead_id,
kind            text  -- 'consulta' | 'procedimento' | 'retorno'
service_type_id uuid  -- → appointment_service_types
scheduled_at    timestamptz
duration_min    int
status          text  -- 'agendado' | 'realizado' | 'cancelado' | 'faltou' | 'remarcado'
notes, created_by, created_at, updated_at
```

Triggers:
- `trg_appointments_set_updated_at` (`20260617210036_*.sql:58`).
- `trg_appointments_recompute` (`20260617210036_*.sql:121`).
- `trg_appointments_auto_sync` — INSERT ou UPDATE OF status →
  `pipeline-deterministic` action `appointment-sync`
  (`20260618022933_*.sql:133-136`).

Mapeamento status × stage destino implementado em
`ruleAppointmentSync` (`pipeline-deterministic/index.ts:309-369`):

| `status`     | `kind`         | Stage destino           | Patch / Tag |
|--------------|----------------|-------------------------|-------------|
| agendado     | consulta       | Consulta agendada       | —           |
| agendado     | procedimento   | Tratamento agendado     | —           |
| agendado     | retorno        | Consulta agendada       | —           |
| realizado    | consulta       | Consulta finalizada     | `status_consulta='realizada'` |
| realizado    | procedimento   | 1ª Sessão Finalizada    | `sessoes_realizadas += 1`     |
| faltou       | qualquer       | Sem resposta            | tag `reagendamento_pendente`, `status_consulta='faltou'` |
| cancelado    | qualquer       | Qualificação            | tag `reagendamento_pendente`, `status_consulta='cancelada'` |

Auto-clear de tags de reagendamento quando volta a `agendado`/`realizado`
(`index.ts:363-369`).

### 3.3 `appointment_service_types` (11 colunas)

Catálogo por clínica (`kind`, `slug`, `label`, `color_hex`,
`default_duration_min`, `active`, `position`). UI em
`src/pages/SettingsAppointmentTypes.tsx`. CRUD em
`src/lib/service-types-mutations.ts` (com `slugify` em :23-31).
Hook ativo: `src/hooks/useServiceTypes.ts` filtra `active=true`.

### 3.4 `lead_custom_fields` (8 colunas)

Definição de campo por clínica:
`id, clinic_id, field_key, label, field_type, options jsonb, position, created_at`.

Tipos suportados (UI `SettingsCustomFields.tsx:15-26`):
`text, number, currency, date, datetime, boolean, select, multiselect, url, textarea`.

Editor: `src/pages/SettingsCustomFields.tsx`.
Renderização no inbox: `src/components/inbox/CustomFieldsPanel.tsx`
(cada tipo tem widget próprio — date/datetime usam popover + `Calendar`;
boolean → `Switch`; multiselect → checkbox-popover).

Hooks de leitura:
- `useCustomFieldDefs` (`src/hooks/useCustomFieldDefs.ts:5-19`) — versão lite.
- `useCustomFieldDefsFull` — inclui `label`.

### 3.5 `automations` + `automation_runs`

```
automations(
  id, clinic_id, name, description, enabled,
  trigger_type   text,
  trigger_config jsonb,
  action_type    text,
  action_config  jsonb,
  cooldown_hours int
)

automation_runs(
  id, automation_id, lead_id, clinic_id,
  status         text,      -- success | error | skipped
  detail         text,
  appointment_at timestamptz, -- snapshot da data alvo (para before_appointment)
  created_at
)
```

`appointment_at` é o que permite reenviar lembrete quando o lead **reagenda**
para outra data (lógica em `shouldSkipForAppointment`,
`supabase/functions/automations-tick/index.ts:35-61`).

### 3.6 `message_sequences` / `_steps` / `_enrollments` / `_runs`

Sequences de N passos com `delay_minutes`, `send_window`, `template_id`/`content`.
Tick: `supabase/functions/sequence-tick/index.ts` (a cada 1 min).
- Avança `current_step`, atualiza `next_run_at`.
- Renderiza template via `renderTemplate` compartilhado.
- Retry até 3x em falha (delay 15min). Após 3 → enrollment `failed`.
- Respeita `send_window` (timezone + janela de horas + weekdays).

### 3.7 `scheduled_messages` (9 colunas)

Tabela genérica para mensagens agendadas fora de sequence/automation.

### 3.8 `lead_stage_history` (11 colunas)

Linha gravada por **toda** mudança de estágio. Campo `source` é a chave para
distinguir manual vs auto: `manual`, `ui`, `auto:appointment-sync`,
`auto:field-changed-consulta`, `auto:field-changed-procedimento`,
`auto:classifier-*`, `auto:automation-rule`, etc.

### 3.9 `pipeline_stages`

`lock_auto_move` (bool) — se `true`, helpers `auto:*` abortam com gate G2
(`pipeline-move.ts`).

### 3.10 `app_settings` (toggles)

Estado atual relevante (consulta via `read_query`):

| Key | Valor |
|---|---|
| `automation.novo_lead.enabled` | true |
| `automation.appointment_sync.enabled` | true |
| `automation.appointment_agendado.enabled` | true |
| `automation.appointment_realizado.enabled` | true |
| `automation.appointment_faltou.enabled` | true |
| `automation.appointment_cancelado.enabled` | true |
| `automation.followup_24h.enabled` | true |
| `automation.followup_3d.enabled` | true |
| `automation.followup_7d_nutricao.enabled` | true |
| `automation.consulta_passou_finaliza.enabled` | **false** (desativada pelo human-transition) |
| `automation.monthly_sweep_paciente_antigo.enabled` | false |
| `automation.inactivity_paciente_antigo.enabled` | true |
| `automation.reactivation.enabled` | true |
| `automation.reactivation_inbound.enabled` | true |
| `automation.nurture_move.enabled` | true |
| `automation.b2b_move.enabled` | true |
| `automation.paciente_antigo_canonical.enabled` | true |

---

## 4. Cron jobs ativos (datas / agendamentos)

| Job | Schedule | O quê |
|---|---|---|
| `automations-tick-every-5-min` | `*/5 * * * *` | Avalia todas `automations` enabled (incluindo `before_appointment`) |
| `sequence-tick-every-minute` | `* * * * *` | Processa `message_sequence_enrollments` due |
| `pipeline-inactivity-tick` | `*/15 * * * *` | `ruleInactivityTick` (24h/3d/7d/60d Paciente antigo) |
| `pipeline-reactivation-tick` | `0 7 * * *` | Tagueia `reativacao` em Nutrição inativa |
| `pipeline-monthly-sweep-paciente-antigo` | `0 3 1 * *` | Move finalizados do mês anterior |
| `pipeline-position-auditor-daily` | `0 6 * * *` | A1 — auditor de posição com regra humana |
| `classifier-daily-batch` | `0 */3 * * *` | Batch de classificação |

`automation.consulta_passou_finaliza` **não tem cron próprio** — o código
está hard-disabled (`pipeline-deterministic/index.ts:761-766`).

---

## 5. Fluxo "card vira agendado" (consulta ou procedimento)

Há **duas portas de entrada** equivalentes:

### 5.1 Porta A — Calendário (`appointments`)

1. Secretária cria entry em `AppointmentDialog` → `createAppointment`
   (`src/lib/appointments-mutations.ts:62-87`).
2. INSERT em `appointments` dispara `trg_appointments_auto_sync` →
   POST `pipeline-deterministic { action: "appointment-sync", appointment_id }`.
3. `ruleAppointmentSync` (`pipeline-deterministic/index.ts:298`) resolve
   `kind+status` → stage canônico → `pipelineMove(...)` com
   `source='auto:appointment-sync'` e `ruleKey='automation.appointment_<status>.enabled'`.
4. Idempotência: `appt:<id>:<status>` (`index.ts:396`).
5. `appointments.status` mudou? Trigger refaz a chamada (resolve realizado/faltou/cancelado).

### 5.2 Porta B — Campo `consulta_agendada_em` / `procedimento_agendado_em`

1. Secretária edita o campo de data no painel do lead
   (`CustomFieldsPanel.tsx:124-180`, salva via `supabase.from('leads').update({ custom_fields })`).
2. UPDATE dispara `trg_leads_auto_field_changed` → POST
   `pipeline-deterministic { action: "field-changed", lead_id, old_custom_fields, new_custom_fields }`.
3. `ruleFieldChanged` (`pipeline-deterministic/index.ts:409`) detecta a
   transição "vazio → preenchido" em uma das duas chaves e move o card
   (`index.ts:488-522`).
4. Idempotência: `field-changed-consulta:<lead>:<iso19>`.
5. **Não cria** `appointment` — apenas move o stage. As duas portas
   coexistem: a clínica pode usar uma, a outra, ou ambas.

### 5.3 O que a IA faz no agendamento

Detecção (sem aplicar) em 4 lugares:
- Agendador (`agent-core.ts:353-361`): classifica
  `scheduling_intent ∈ {novo_agendamento, reagendamento, cancelamento, duvida_agenda, nenhum}`.
- Summarizer extrai `mentioned_dates[]` (`agent-core.ts:291-298`).
- `date-parser.ts:22-41` resolve datas relativas PT-BR no timezone
  `America/Sao_Paulo` usando `parseFutureDateInTZ` (`_shared/dates.ts:35-100`).
- Datas resolvidas para chaves de `HUMAN_SCHEDULING_FIELDS` são
  **rejeitadas** com `reason='ai_scheduling_disabled_by_human_transition'`
  (`apply.ts:225-232`).
- Sugestões de stage em `HUMAN_SCHEDULING_STAGES` viram
  `path='general', reason='ai_scheduling_disabled_by_human_transition'`
  (`apply.ts:433-442`).

### 5.4 Finalização

A IA **não** move para `Consulta finalizada` / `1ª Sessão Finalizada`.
A secretária faz manualmente OU vem de `appointments.status='realizado'`
via `ruleAppointmentSync`. O antigo cron `ruleConsultaPassou` está
desligado para evitar finalização precoce em clínicas com múltiplos
procedimentos paralelos (`pipeline-deterministic/index.ts:761-766`).

### 5.5 Mensalização — `Paciente antigo`

`ruleMonthlySweep` (`index.ts:866+`) no dia 1 às 03:00 move leads em
`Consulta finalizada` / `1ª Sessão Finalizada` (com `stage_changed_at <`
primeiro dia do mês) para `Paciente antigo` + `eh_paciente_antigo=true`.
Toggle hoje `false`.

---

## 6. Campos personalizados (lifecycle)

### 6.1 Criação

`SettingsCustomFields.tsx` (super-admin / membro) → INSERT em
`lead_custom_fields`. `field_key` é gerado por `slugify(label)` e é
**imutável** depois de criado (`SettingsCustomFields.tsx:155`).

### 6.2 Leitura/edição

| Local | Componente | Persistência |
|---|---|---|
| Inbox (rail direito) | `CustomFieldsPanel.tsx` | UPDATE `leads.custom_fields` direto |
| Inbox (`ContextRail.tsx`) | wrapper | idem |
| Kanban (modal lead) | usa hooks | idem |
| Pipeline IA | `apply.ts` | RPC `apply_lead_automation_patch` (atômica, não dispara G10) |
| Deterministic | `patchCustomFields` (merge superficial) | `index.ts:102-114` |
| Forms / Webhooks | `forms-ingest`, `external-lead-capture` | INSERT lead com `custom_fields` |

### 6.3 Normalização

- **Boolean**: aceita `true/sim/1/yes/y` (=`sim`) e `false/nao/não/0/no/n/""`
  (=`nao`) — `automations-tick/index.ts:182-187` (`normBool`).
- **Date/datetime**: valor é guardado como string ISO (`new Date().toISOString()`)
  no UI; parse legível em `template-vars.ts` aceita `YYYY-MM-DD`
  (interpretado como meio-dia local) e ISO completo.
- **Select/multiselect**: validados contra `options` declaradas pelo
  trigger `trg_validate_lead_custom_fields_enums` e re-validados em
  `apply.ts:241-260` antes do RPC (P10).

### 6.4 G10 — proteção a edição humana

Janela de 7 dias (`G10_WINDOW_MS = 7 * 24 * 60 * 60 * 1000` em `schema.ts:75`).
Edição humana é registrada em `leads.custom_fields_last_human_edit` por
chave. Dentro da janela, IA não sobrescreve. Override de data exige
`confidence ≥ 0.85` (`apply.ts:176-198`).

### 6.5 Cleanup

`cleanup-g10-expired-daily` (cron diário às 04:00) zera marcas expiradas.

---

## 7. Variáveis de template (datas e campos)

Renderer compartilhado: `supabase/functions/_shared/template-vars.ts` e
espelho frontend `src/lib/template-vars.ts` (**mantenha em sync**).

Sintaxe:

| Variável | O quê |
|---|---|
| `{{nome}}` | `lead.name` ou `lead.phone` fallback |
| `{{primeiro_nome}}` | primeira palavra de `name` |
| `{{telefone}}` | `lead.phone` |
| `{{email}}` | `lead.email` |
| `{{empresa}}` | `lead.company` |
| `{{campo.<chave>}}` | valor cru de `custom_fields[chave]` (formatado por tipo) |
| `{{campo.<chave>:data}}` | só data `dd/MM/yyyy` (para date/datetime) |
| `{{campo.<chave>:hora}}` | só hora `HH:mm` |
| `{{campo.<chave>:dia_semana}}` / `:weekday` | nome do dia em pt-BR |
| `{{campo.<chave>:extenso}}` | "19 de junho de 2026 às 10:00" |

Tipo `boolean` vira `sim`/`não`; array vira lista por `, `.

Timezone fixo: `America/Sao_Paulo` (`_shared/template-vars.ts:17`).

Quem usa o renderer:
- `automations-tick` (action `send_template`) — `index.ts:333-341`.
- `sequence-tick` — `index.ts:110`.
- Frontend: prévias de template (`message_templates`, quick replies, broadcasts).

---

## 8. Automações UI (`/automations`)

UI: `src/pages/Automations.tsx`. Backend tick: `automations-tick`.

### 8.1 Triggers suportados (combo em :27-31)

| `trigger_type` | Quando dispara | `trigger_config` chaves |
|---|---|---|
| `no_reply_after` | Lead em estágio X sem resposta há N horas (último msg inbound) | `hours`, `stage_ids[]` opcional |
| `stage_idle` | Lead parado em estágio há N horas (`stage_changed_at`) | `hours`, `stage_ids[]` |
| `before_appointment` | Antes de uma data marcada em campo personalizado | ver abaixo |

### 8.2 `before_appointment` — anatomia completa

UI: `Automations.tsx:279-422`.
Backend: `automations-tick/index.ts:130-244`.

`trigger_config`:

```jsonc
{
  "field_key": "consulta_agendada_em",      // qualquer custom field date/datetime
  "offset_minutes": 1440,                    // antecedência (ex.: 1440=24h, 60=1h)
  "offset_unit": "days|hours|minutes",       // UI helper; bate em offset_minutes
  "preferred_time": "15:00",                 // opcional — segura D-1 até esse horário
  "tz": "America/Sao_Paulo",                 // default
  "stage_id": "<uuid>",                      // opcional — filtra por estágio
  "business_hours_only": true,               // Seg-Sex
  "business_hours_start": 10,
  "business_hours_end": 22,
  "condition": {                             // opcional — filtro por outro custom field
    "field_key": "teleconsulta",
    "op": "eq|neq|empty|not_empty",
    "value": "sim"
  }
}
```

Lógica do tick (`index.ts:130-244`):

1. Janela ampla `[now-5min, now + offset + 24h]`, fetch até 200 leads
   da clínica com a chave não-nula.
2. Calcula hora local no `tz`. Aplica `business_hours_only` e
   `preferred_time` cedo (return [] global).
3. Para cada lead:
   - Parse `appt = new Date(raw)`.
   - `target = appt - offset`.
   - Dispara se `now ∈ [target, appt-5min]`.
   - **Anti-broadcast retroativo**: se `lead.updated_at` (proxy para
     "agendado hoje") é o mesmo dia da consulta E offset ≥ 6h, **skip**
     com `same_day_short_notice` (evita lembrete de "amanhã" criado hoje).
     Idem se faltam <5h.
   - Avalia `condition` por custom field (com `normBool`). Skip com
     `condition_not_matched` se falhar.
4. **Cooldown inteligente** (`shouldSkipForAppointment` :35-61): só
   bloqueia se o último run de sucesso foi para a MESMA `appointment_at`.
   Reagendamento (data nova) **libera** novo disparo.
5. **Piso de cooldown** para `before_appointment`:
   `max(cooldown_hours, ceil(offset_h * 1.5), 1)` — evita reenvio a cada
   tick quando o usuário põe `cooldown_hours=0` (`index.ts:384-386`).
6. `appointment_at` gravado em `automation_runs.appointment_at` para
   suportar #4.

### 8.3 Ações disponíveis

| `action_type` | `action_config` | O quê faz |
|---|---|---|
| `ai_followup` | `agent_id`, `prompt` | Chama `ai-chat` com histórico + instrução, envia via `evolution-send` |
| `move_stage` | `stage_id` | `pipelineMove(source='auto:automation-rule', ruleKey='automation.ui_rule_move.enabled')` |
| `send_template` | `template_id` | Busca `message_templates.content`, renderiza vars, envia |

### 8.4 Condição por custom field (teleconsulta vs presencial)

Recurso recente: dentro do trigger `before_appointment` o usuário pode
adicionar uma `condition`. Útil quando há duas automações para a mesma
data — uma com `teleconsulta = sim` (link da chamada), outra com
`teleconsulta = nao` (endereço da clínica). UI: `Automations.tsx:356-417`.
Avaliação: `automations-tick/index.ts:222-236`. Tipos suportados:
boolean (normBool), select (valor literal), texto livre.

### 8.5 Cross-clinic guard

`automations-tick/index.ts:389-398` rejeita explicitamente qualquer lead
de clínica diferente da automação (defesa em profundidade).

---

## 9. Pipeline IA — datas no fluxo do classificador

Pipeline em 5 agentes serial (`pipeline-classify/agent-core.ts`):

1. **Summarizer** — extrai resumo + `mentioned_dates[]` (raw + anchor_iso + kind).
2. **Agendador** — `scheduling_intent` (não aplica nada).
3. **Tipificador** — preenche `custom_fields_patch` (com whitelist de chaves) e
   `tags_suggested` (com whitelist em `app_settings.automation.v42.allowed_tags`).
   GATE 11: bloqueado de tocar em `consulta_agendada_em`,
   `procedimento_agendado_em`, `sessions_requested`
   (`agent-core.ts:468`).
4. **Movimentador** — sugere `stage_suggestion`. Trava humana em :525-528.
5. **Maestro** — consolida.

`apply.ts` aplica:
- Datas resolvidas via `resolveMentionedDates` (`date-parser.ts:22-41`)
  → `apply.ts:214-234`.
- Para chaves humanas: rejeita com motivo canônico.
- Para outras (ex.: `pagamento_alegado_em`): aplica via `tryApplyField`
  (com G10 bypass para datas com confiança ≥ 0.85).

Telemetria escrita em `lead_events.type='auto:classifier'`
(`apply.ts:587-598`) e em `pipeline_runs.result`.

---

## 10. Auditor A1 (`pipeline-position-auditor`)

Cron diário. Detecta leads parados >7d. Prompt explicitamente proibido
de sugerir mover para estágios humanos
(`pipeline-position-auditor/index.ts:143-145`). Pula leads com
`appointment` futuro registrado (`index.ts:196-201`). Idempotente em 14d.

---

## 11. `pipeline-deterministic` — quem dispara

Roteador único, action-based. Disparadores:

| Disparador | Action |
|---|---|
| Trigger `trg_leads_after_insert` (lead novo) | `novo-lead` |
| Trigger `trg_messages_auto_secretary` (msg outbound) | `secretary-replied` |
| Trigger `trg_messages_auto_reactivation_inbound` (msg inbound) | `reactivation-inbound` |
| Trigger `trg_appointments_auto_sync` | `appointment-sync` |
| Trigger `trg_leads_auto_field_changed` | `field-changed` |
| Cron `pipeline-inactivity-tick` | `inactivity-tick` |
| Cron `pipeline-reactivation-tick` | `reactivation-tick` |
| Cron `pipeline-monthly-sweep-paciente-antigo` | `monthly-sweep-tick` |
| (manual via `human-reactor-tick`) | `human-reactor-tick` |

Todas as actions passam por `pipelineMove` (gates G2/G3/G4/G5/G8 + D3),
ver `supabase/functions/_shared/pipeline-move.ts`.

---

## 12. Integrações de entrada que escrevem datas/custom_fields

- `supabase/functions/forms-ingest/index.ts` — converte respostas de form
  em `leads.custom_fields`. Pode preencher `consulta_agendada_em` se o
  form tiver campo de data.
- `supabase/functions/external-lead-capture/index.ts` — webhook de
  captura externa; mesma lógica.
- `supabase/functions/pipeline-payment-webhook/index.ts` — escreve
  `pagamento_alegado_em` / status.
- `supabase/functions/outreach-recovery-tick/index.ts` — usa
  `last_inbound_at` para reativação.

---

## 13. Convenções e invariantes

1. **Timezone único**: `America/Sao_Paulo` (renderer, parser, FullCalendar
   em `PipelineCalendar.tsx:111`).
2. **Datas em `custom_fields` SEMPRE ISO 8601 com hora** (UI sempre grava
   `Date.toISOString()`).
3. **`field_key` é imutável** após criação — alterar quebra automações
   que referenciam por chave.
4. **Trigger `field-changed` é o único acoplamento** entre edição manual
   de data e movimento determinístico de stage. Se a UI bypassar e
   atualizar `custom_fields` por outro caminho (ex.: RPC direto sem
   trigger), o stage **não** é movido.
5. **`automation_runs.appointment_at`** é a chave de "mesmo agendamento"
   vs "reagendou" — não deixe de gravar em novos action_types.
6. **Whitelist de tags** em `app_settings.automation.v42.allowed_tags`
   (carregada em `apply.ts:47-61`); tags fora viram `tagsDropped` na
   telemetria.
7. **A IA não move para estágios de agendamento/finalização**. Mexer
   nisso exige revogar a transição humana (toggle dedicado + revisão de
   prompts + reabilitar `ruleConsultaPassou`).
8. **Cron de finalização (`consulta_passou_finaliza`) está desligado por
   código** — `app_settings` não basta para religar.

---

## 14. Pegadinhas conhecidas

- **`automations-tick` usa `lead.updated_at`** como proxy de "agendado
  hoje". Se algum job de manutenção tocar em `leads` sem propósito de
  agendamento, pode falsar o `same_day_short_notice` e suprimir lembretes
  legítimos (`automations-tick/index.ts:206-219`).
- **`patchCustomFields` em `pipeline-deterministic`** faz merge
  superficial; arrays/objetos aninhados são substituídos.
- **Sequence-tick** sobrescreve `whatsapp_instance_id` do lead se a
  sequence tiver uma e o lead estiver null (`sequence-tick/index.ts:115-117`).
- **Frontend e backend têm duas cópias do renderer** — sempre sincronize
  `src/lib/template-vars.ts` ↔ `supabase/functions/_shared/template-vars.ts`.
- **`consulta_agendada_em` / `procedimento_agendado_em` não estão
  cadastrados como `lead_custom_fields`** por padrão na consulta atual —
  podem estar em outras clínicas. Para aparecerem na UI de seleção de
  `before_appointment` precisam estar declarados como tipo `date`/`datetime`.
- **Calendário só lê `appointments`** — leads cujo agendamento veio só
  via campo `consulta_agendada_em` (sem appointment) **não aparecem** no
  calendário. Adaptações futuras precisam decidir se "unificam" essas
  duas fontes.
- **Idempotência por `appointment_at` com precisão de segundo** — se a
  secretária ajustar a data em 1 segundo, conta como reagendamento.

---

## 15. Pontos de extensão (para a próxima adaptação)

- **Novo trigger `date_reminder`**: hoje a UI **não tem** opção
  separada para "lembrete por qualquer campo de data" — só
  `before_appointment`. A doc anterior mencionava `date_reminder`, mas
  na implementação atual o mecanismo único é o `before_appointment`
  parametrizado por `field_key`. Se quiser semântica diferente
  (ex.: lembrete X dias DEPOIS de uma data), precisa nova rama.
- **Múltiplas condições**: hoje só uma `condition` (1 field op value).
  Se precisar AND/OR, expandir `condition` para `{all: [...]}` /
  `{any: [...]}` e atualizar `automations-tick/index.ts:222-236`.
- **Lembretes encadeados**: hoje há `message_sequences` (steps com
  delay relativo), mas não há "sequence ancorada em data de consulta".
  Para D-3 → D-1 → D-0 encadeados, hoje exige 3 automações
  `before_appointment` separadas (ou uma sequence que enrolla quando o
  campo é preenchido).
- **Unificar agenda**: criar trigger que cria `appointment` automaticamente
  quando `consulta_agendada_em` é preenchido (e vice-versa) — hoje as
  duas portas convivem desconectadas.
- **Lembrete pós-consulta** (D+1, D+7): inexistente como trigger nativo;
  hoje vira tag manual ou sequence.
- **Múltiplos agendamentos paralelos**: clínica OR tem leads com consulta
  + procedimento simultâneos. Foi a razão de desligar `ruleConsultaPassou`.
  Qualquer nova regra de "data passou" deve lidar com **N datas no mesmo
  lead**.
- **Confirmação 2-way**: nenhum mecanismo hoje marca
  `status_consulta='confirmada'` automaticamente em resposta do lead.
  IA detecta intenção (`scheduling_intent`), mas não age.

---

## 16. Índice cruzado (arquivo → responsabilidade)

### Frontend

| Arquivo | Responsabilidade |
|---|---|
| `src/pages/Automations.tsx` | UI de regras (3 triggers, 3 actions, condição por field) |
| `src/pages/SettingsCustomFields.tsx` | CRUD de `lead_custom_fields` |
| `src/pages/SettingsAppointmentTypes.tsx` | CRUD de `appointment_service_types` |
| `src/components/inbox/CustomFieldsPanel.tsx` | Widget por tipo (date popover, multiselect, etc.) |
| `src/components/inbox/ContextRail.tsx` | Container do panel + outros widgets |
| `src/components/kanban/calendar/PipelineCalendar.tsx` | FullCalendar wrapper |
| `src/components/kanban/calendar/AppointmentDialog.tsx` | Modal criar/editar appointment |
| `src/hooks/useAppointments.ts` | Fetch + realtime + `appointmentToEvent` |
| `src/hooks/useServiceTypes.ts` | Catálogo de serviços (active=true) |
| `src/hooks/useCustomFieldDefs.ts` | Defs para renderer e UIs |
| `src/lib/appointments-mutations.ts` | create/update/status/delete |
| `src/lib/service-types-mutations.ts` | CRUD + `slugify` |
| `src/lib/template-vars.ts` | Espelho frontend do renderer |
| `src/lib/manual-stage-move.ts` | Move manual via UI (kanban drag) |
| `src/types/crm.ts` | `CustomFieldDef`, `FieldType`, `Lead` |

### Backend

| Arquivo | Responsabilidade |
|---|---|
| `supabase/functions/automations-tick/index.ts` | Cron 5min: 3 triggers, 3 actions |
| `supabase/functions/sequence-tick/index.ts` | Cron 1min: sequence enrollments |
| `supabase/functions/pipeline-deterministic/index.ts` | Roteador de regras `auto:*` (novo-lead, secretary, reactivation, appointment-sync, field-changed, inactivity, reactivation tick, sweep) |
| `supabase/functions/pipeline-classify/agent-core.ts` | 5 agentes IA + prompts + travas humanas |
| `supabase/functions/pipeline-classify/apply.ts` | Aplica resultado: tags, custom_fields, stage move com gates + rejeições humanas |
| `supabase/functions/pipeline-classify/date-parser.ts` | Resolve `mentioned_dates` no tz |
| `supabase/functions/pipeline-classify/schema.ts` | Canon stages, DATE_FIELD_KEYS, G10_WINDOW_MS, PROTECTED_TAGS |
| `supabase/functions/pipeline-position-auditor/index.ts` | A1 — auditor de leads parados, prompt com trava humana |
| `supabase/functions/_shared/template-vars.ts` | Renderer compartilhado de templates |
| `supabase/functions/_shared/dates.ts` | `parseFutureDateInTZ`, `parseFutureDate` |
| `supabase/functions/_shared/pipeline-move.ts` | Helper único de move + gates |
| `supabase/functions/_shared/pipeline-tasks.ts` | Tasks programadas por automação |
| `supabase/functions/forms-ingest/index.ts` | Forms → custom_fields |
| `supabase/functions/external-lead-capture/index.ts` | Webhook lead → custom_fields |
| `supabase/functions/pipeline-payment-webhook/index.ts` | Pagamento → `pagamento_alegado_em`, status |
| `supabase/functions/outreach-recovery-tick/index.ts` | Reativação por last_inbound_at |

### Migrations relevantes

| Arquivo | O quê |
|---|---|
| `20260617210036_*.sql` | Cria `appointments` + triggers `updated_at`/`recompute` |
| `20260618022933_*.sql` | Helper `notify_pipeline_deterministic` + 4 triggers (`novo-lead`, `secretary-replied`, `appointment-sync`, `field-changed`) |
| `20260618151428_*.sql` | `trg_track_custom_fields_human_edits` (G10) |
| `20260614225820_*.sql` | `trg_validate_lead_custom_fields_enums` |
| `20260622193525_*.sql` | `trg_messages_auto_reactivation_inbound` |
| `20260622135216_*.sql`, `20260622024500_*.sql`, `20260622004827_*.sql`, `20260621234808_*.sql` | Ajustes de calendar/appointments |
| `20260624180427_*.sql` | Toggles da transição humana |

### Documentação correlata

- `docs/pipeline/CALENDAR.md` — modelo de dados do calendário.
- `docs/pipeline/CALENDAR_PLAN.md` — plano original.
- `docs/pipeline/AUTOMATION_PLAN.md` — visão de automações.
- `docs/pipeline/CUSTOM_FIELDS_E_TAGS.md` — convenções de chaves/tags.
- `docs/pipeline/runtime/USER_AUTOMATIONS.md` — manual de uso das regras.
- `docs/pipeline/runtime/DETERMINISTIC_RULES.md` — catálogo das regras `auto:*`.
- `docs/pipeline/runtime/FIELDS_LIVE.md` — campos ativos em produção.
- `docs/pipeline/runtime/STAGES_LIVE.md` — estágios ativos.
- `docs/pipeline/runtime/FLOW_MATRIX.md` — matriz cenário → ator → stage.
- `docs/pipeline/runtime/CLASSIFIER.md` — provider/modelo atual da IA.
- `docs/pipeline/runtime/KNOWN_ISSUES.md` — issues abertas (inclui human transition).
- `docs/estudo/03-consulta-agendada.md`, `05-consulta-finalizada.md`,
  `10-procedimento-agendado.md`, `13-antigo-consultaprocedimento-agendado.md`,
  `clinica-or-fluxo-novo.md` — narrativa de cenários.

---

**Fim.** Qualquer adaptação envolvendo data, agendamento, lembrete ou
custom field deve passar por: (1) seção 4 (cron), (2) seções 5–8 (fluxos),
(3) seção 13 (invariantes) e (4) seção 15 (extensões já mapeadas).

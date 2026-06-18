---
title: "Pipeline — Schema do banco"
topic: database
kind: reference
audience: agent
updated: 2026-06-18
summary: "Tabelas, triggers, enums e gates relevantes para automação do pipeline. Inclui triggers que já escrevem em leads e custom_fields com enum implícito."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/AUTOMATION_PLAN.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
---

# Schema do banco — superfície de automação do pipeline

Todas as tabelas têm RLS `clinic_scoped` por `current_clinic_id()`. Qualquer função/edge function de automação deve rodar com `service_role` OU setar `clinic_id` antes do query.

## `pipelines`
Pipeline = funil. A clínica tem vários (ex: `Clínica ÓR`, `Pacientes`, `consultas`, `Medicos Parceiros`, e um por instância de WhatsApp `Formulário Site`).

Colunas-chave:
- `id`, `clinic_id`, `name`, `kind` (`sales`|`internal`), `is_default`, `is_system`, `system_key`, `whatsapp_instance_id`.
- Pipeline default da ÓR: `17c27f4d-8256-4ea7-b5b9-ed706494f686`.

## `pipeline_stages`
Colunas do funil.

- `id`, `pipeline_id`, `name`, `position`, `is_terminal`, `lock_auto_move`.
- `is_terminal=true` → não retorna ao funil (B2B, Desqualificado).
- `lock_auto_move=true` → automação NÃO move leads PARA esse stage. **v3**: `Procedimento pago` recebe esta flag.

## `leads` (42 colunas — só relevantes para automação)

- **Posição no funil**: `pipeline_id` (⚠️ derivado por trigger, ver abaixo), `stage_id`, `position`, `stage_changed_at`.
- **Identidade**: `name`, `phone`, `email`, `clinic_id`, `whatsapp_instance_id`, `attendant_id`.
- **Estado livre**: `tags text[]`, `custom_fields jsonb` (ver `CUSTOM_FIELDS_E_TAGS.md`).
- **Atividade**: `last_message_at`, `last_message_preview`, `last_human_activity_at`, `last_site_activity_at`, `unread_count`.
- **Triagem IA (campos reaproveitáveis pela v3)**:
  - `ai_summary text` — usado pelo Summarizer da Fase 3 (resumo incremental ≤800 chars).
  - `needs_ai_review boolean`, `ai_review_reasons text[]` — flag para Classifier escalar para humano.
  - `last_classified_at timestamptz` — quando Classifier rodou pela última vez.
  - **Nenhum desses tem writer ativo hoje** (agente antigo removido).
- **Lock manual** ⚠️: `manual_lock_until` — **7 dias** após arraste humano. Bloqueia movimentação automática de stage. **Não bloqueia** escrita de tags/custom_fields/ai_summary.
- **Origem**: `landing_page`, `utm_*`, `gclid`, `fbclid`, `form_source`.
- **Flags**: `archived_at`, `pinned_at`, `marked_unread`, `is_internal_contact`.

### Novas colunas (Fase 0 migration)

```sql
ALTER TABLE leads
  ADD COLUMN last_processed_message_id_classifier uuid REFERENCES messages(id),
  ADD COLUMN last_processed_message_id_summarizer uuid REFERENCES messages(id);
```

Dois ponteiros: classifier sempre avança (barato), summarizer só quando dispara (caro, batched).

## `lead_stage_history`
Toda movimentação **deve** ser registrada aqui.

- `lead_id`, `from_stage_id`, `to_stage_id`, `moved_at`.
- `moved_by_user_id` (humano) **ou** `moved_by_agent_id` (agente IA — FK para `ai_agents`).
- `source text` — convenção: `'manual'`, `'auto:<rule>'`, `'system:<reason>'`. Indexado.
- `reason text` — texto livre legível.
- `metadata jsonb` — payload (ex: trigger event id, confidence score, `appointment_id`).

## `lead_events`
Log livre de eventos por lead. **Trilha de idempotência** das automações.

- `type text` — convenções v3:
  - `appointment_status_synced` (dedup das 5 regras `auto:appointment-*`, payload com `appointment_id` + `status`).
  - `payment_confirmed`, `payment_alleged`.
  - `nf_solicitada`.
  - `reminder_sent` (payload com `appointment_id`).
  - `inactivity_detected`.
  - `urgency_flagged`.
  - `reactivation_during_lock`.
  - `classifier_ran` (payload com `last_processed_message_id`, `confidence`, `intent`).
- `payload jsonb`, `actor_user_id` (null se sistema).
- Indexado por `(lead_id, created_at)` e `(type, created_at)`.

## `lead_tasks`
Tarefas vinculadas ao lead.

- `title`, `due_at`, `done_at`.
- Use para "Emitir NF", "Confirmar pagamento", "Follow-up liminar", "Oferecer novo horário (no-show)", "Reagendamento pendente".
- Dedup: idempotência verifica se já existe task aberta de mesmo `title` no mesmo lead.

## `appointments`
Consultas e procedimentos marcados. **Motor das 5 regras `auto:appointment-*` (Fase 1, código puro).**

- `kind` CHECK in (`'consulta'`, `'procedimento'`, `'retorno'`).
- `status` CHECK in (`'agendado'`, `'realizado'`, `'cancelado'`, `'faltou'`, `'remarcado'`).
- `scheduled_at`.
- Trigger `trg_appointments_recompute` recalcula campos derivados no lead.
- **Importante**: criar appointment **NÃO seta** `manual_lock_until`. Por isso `auto:inactivity-5d` precisa de exceção explícita pra leads com appointment futuro.

### Mapeamento `appointments` → ações (Fase 1)

Trigger Postgres em `INSERT OR UPDATE OF status` em `appointments` chama edge function `pipeline-appointment-sync`. Idempotência por `lead_events.type='appointment_status_synced'` com `payload->>'appointment_id'`.

| Evento | Regra | Ação |
|---|---|---|
| INSERT status=agendado, kind=consulta | `auto:appointment-agendado` | Mover lead → `Consulta agendada` |
| INSERT status=agendado, kind=procedimento | `auto:appointment-agendado` | Mover lead → `Procedimento agendado` |
| UPDATE status→realizado, kind=consulta | `auto:appointment-realizado` | Mover lead → `Consulta finalizada` |
| UPDATE status→realizado, kind=procedimento | `auto:procedure-realizado` | Se 1ª sessão: mover → `Em tratamento`. Senão: incrementar `custom_fields.sessoes_realizadas` (numérico), não move. |
| UPDATE status→faltou | `auto:appointment-faltou` | Mover → `Sem resposta` + tag `no_show` + task "Reagendar" D+1 |
| UPDATE status→cancelado | `auto:appointment-cancelado` | Mover → `Qualificação` + tag `reagendamento_pendente` + task "Oferecer novo horário" |

## Triggers de banco que já escrevem em leads (R1, R2, R3)

| Trigger | O que faz | Implicação para automação |
|---|---|---|
| `tg_lead_risk_handler` | Quando classificação detecta risco clínico, injeta tag `risco_clinico` em `leads.tags`. | **R1**: Classifier deve sempre `MERGE` tags (`array_cat` + `array(select distinct)`), nunca `SET`. Senão sobrescreve o trigger. |
| `trg_validate_lead_custom_fields_enums` | Valida que `custom_fields.qualificacao='desqualificado'` exige `custom_fields.motivo_desqualificacao` não-nulo. | **R2**: Classifier que sugere desqualificação deve preencher ambos juntos no mesmo UPDATE. |
| `sync_lead_pipeline_id` | Deriva `leads.pipeline_id` a partir de `pipeline_stages.pipeline_id` do `stage_id` atual. | **R3**: Nunca escrever `pipeline_id` diretamente. Mudar só `stage_id`. |

## `lead_custom_fields`
Definição dos campos custom por clínica (schema). Os valores moram em `leads.custom_fields jsonb`. Hoje há **10 defs** + 8 com enum implícito validado por trigger. Lista completa e enums em `CUSTOM_FIELDS_E_TAGS.md`.

**Fase 0.5 cria 8 defs novos** que o estudo exige mas não existem hoje (`possui_liminar_judicial`, `saldo_sessoes_pacote`, `nome_responsavel_financeiro`, `sessoes_realizadas`, etc.).

## `stage_sequence_bindings` (NOVA — Fase 0)

Mapa `(pipeline_id, stage_id) → message_sequences.id` que enrolla lead automaticamente em sequência ao entrar no stage. Suporta C14.

```sql
CREATE TABLE public.stage_sequence_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES message_sequences(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, stage_id, sequence_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_sequence_bindings TO authenticated;
GRANT ALL ON public.stage_sequence_bindings TO service_role;
ALTER TABLE public.stage_sequence_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic_scoped" ON public.stage_sequence_bindings
  USING (clinic_id = current_clinic_id());
```

Trigger em `lead_stage_history` AFTER INSERT verifica bindings ativos e enrolla em `message_sequence_enrollments` com `source='auto:stage_binding'`.

## `app_settings` — toggles de automação

Toda regra `auto:*` é controlada por `app_settings` com chave `automation.<rule>.enabled`. **Off by default** na Fase 0:

```sql
INSERT INTO app_settings (key, value, scope, clinic_id) VALUES
 ('automation.appointment-agendado.enabled',  'false', 'clinic', '<clinic-id>'),
 ('automation.appointment-realizado.enabled', 'false', 'clinic', '<clinic-id>'),
 ('automation.appointment-faltou.enabled',    'false', 'clinic', '<clinic-id>'),
 ('automation.appointment-cancelado.enabled', 'false', 'clinic', '<clinic-id>'),
 ('automation.procedure-realizado.enabled',   'false', 'clinic', '<clinic-id>'),
 ('automation.inactivity-5d.enabled',         'false', 'clinic', '<clinic-id>'),
 ('automation.reactivation.enabled',          'false', 'clinic', '<clinic-id>'),
 ('automation.reminder-d1.enabled',           'false', 'clinic', '<clinic-id>'),
 ('automation.modality-guard.enabled',        'false', 'clinic', '<clinic-id>'),
 ('automation.b2b-move.enabled',              'false', 'clinic', '<clinic-id>'),
 ('automation.urgency-flag.enabled',          'false', 'clinic', '<clinic-id>'),
 ('automation.payment-confirmed.enabled',     'false', 'clinic', '<clinic-id>'),
 ('automation.nf-task.enabled',               'false', 'clinic', '<clinic-id>');
```

## RPCs / helpers existentes

- `current_clinic_id()` — pega clínica do JWT.
- `manual-stage-move.ts` (frontend hook) — grava `lead_stage_history` com `source='manual'` e seta `manual_lock_until = now() + 7d`.
- `trg_appointments_recompute` — campos derivados do lead.

## Edge functions úteis

- `evolution-webhook` — entry point WhatsApp; hook síncrono pro classifier.
- `ai-assist`, `ai-chat`, `ai-auto-reply` — Lovable AI Gateway cabeado.
- `automations-tick`, `sequence-tick`, `email-automations-tick` — templates de cron.
- `transcribe-audio` — áudios.

## Tabelas residuais do agente antigo

- `lead_ai_settings`, `stage_ai_defaults` — vazias, ainda referenciadas pelo agente de auto-reply. **Não dropar, não reusar.**

## Limites operacionais

- Sem cron jobs ativos para o pipeline hoje. Reativar via `cron.schedule()` em migration ao criar nova tick function.
- Não existe tabela de "regras configuráveis" hoje. Fase 1 é hardcoded; configurável só vem se houver 3+ regras estáveis.

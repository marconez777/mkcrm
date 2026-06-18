---
title: "Pipeline — Schema do banco (v4.1)"
topic: database
kind: reference
audience: agent
updated: 2026-06-18
summary: "Tabelas, triggers, enums e gates do banco para automação do pipeline v4.1. Inclui campos novos da Fase 0.5 (status_financeiro, interesse_consulta/tratamento, ciclo_concluido) e fonte de detecção de ação humana."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/AUTOMATION_PLAN.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
---

# Schema do banco — superfície de automação do pipeline (v4.1)

Todas as tabelas têm RLS `clinic_scoped` por `current_clinic_id()`. Edge functions de automação rodam com `service_role` OU setam `clinic_id` antes do query.

## `pipelines`

Pipeline = funil. Pipeline default da ÓR: `17c27f4d-8256-4ea7-b5b9-ed706494f686`.

## `pipeline_stages`

- `id`, `pipeline_id`, `name`, `position`, `is_terminal`, `lock_auto_move`.
- **v4.1**: nenhum stage tem `lock_auto_move=true` (era usado em "Procedimento pago", coluna eliminada — D1).

## `leads` (42 colunas — só as relevantes para automação)

- **Posição**: `pipeline_id` (⚠️ derivado por trigger), `stage_id`, `position`, `stage_changed_at`.
- **Identidade**: `name`, `phone`, `email`, `clinic_id`, `whatsapp_instance_id`, `attendant_id`.
- **Estado livre**: `tags text[]`, `custom_fields jsonb` (ver `CUSTOM_FIELDS_E_TAGS.md`).
- **Atividade**: `last_message_at`, `last_message_preview`, `last_human_activity_at`, `unread_count`.
- **Triagem IA**:
  - `ai_summary text` — Summarizer Fase 3.
  - `needs_ai_review boolean`, `ai_review_reasons text[]` — flag para escalar humano.
  - `last_classified_at timestamptz`.
- **Lock manual**: `manual_lock_until` — **7 dias** após arraste humano. Renovado pelo reator (D7).
- **Origem**: `landing_page`, `utm_*`, `gclid`, `fbclid`, `form_source`.

### Novas colunas (Fase 0 migration)

```sql
ALTER TABLE leads
  ADD COLUMN last_processed_message_id_classifier uuid REFERENCES messages(id),
  ADD COLUMN last_processed_message_id_summarizer uuid REFERENCES messages(id);
```

## `lead_stage_history`

Toda movimentação **deve** ser registrada aqui. **Fonte de detecção de ação humana** para o reator (D7).

- `lead_id`, `from_stage_id`, `to_stage_id`, `moved_at`.
- `moved_by_user_id` (humano) **ou** `moved_by_agent_id` (agente IA).
- `source text` — convenções:
  - `'manual'` — usuário arrastou no Kanban (`useManualStageMove`).
  - `'ui'` — outras interações de UI (modal, drawer).
  - `'auto:<rule>'` — regra determinística.
  - `'system:<reason>'` — trigger ou job interno.
  - `'reator:<inferencia>'` — reator humano (D7) inferiu consequência.
- `reason text` — texto livre.
- `metadata jsonb` — payload (event id, confidence, `appointment_id`).

**Reator humano (D7) escuta**: trigger AFTER INSERT em `lead_stage_history` onde `source IN ('manual','ui')`. Tabela de inferências no `AUTOMATION_PLAN.md`.

## `lead_events`

Log livre de eventos por lead. **Trilha de idempotência** das automações.

- `type text` — convenções v4.1:
  - `welcome_sent` (1x por `lead_id`).
  - `secretary_replied` (1x por `lead_id`).
  - `appointment_status_synced` (dedup das `auto:appointment-*`, payload com `appointment_id` + `status`).
  - `payment_confirmed`, `payment_alleged`.
  - `nf_solicitada`.
  - `followup_sent` (payload com `attempt`: 1, 2 ou 3).
  - `inactivity_promoted_to_nutricao` (transição C5c).
  - `urgency_flagged`.
  - `reactivation_during_lock`.
  - `classifier_ran` (payload com `last_processed_message_id`, `confidence`, `intent`).
  - `human_action_reacted` (payload com regra do reator que disparou).
  - `stuck_flagged` (payload com motivo da `precisa_atencao_humana`).
- `payload jsonb`, `actor_user_id` (null se sistema).
- Indexado por `(lead_id, created_at)` e `(type, created_at)`.

## `lead_tasks`

- `title`, `due_at`, `done_at`.
- Dedup: regras checam se já existe task aberta de mesmo `title` no mesmo lead.

## `appointments`

Consultas e tratamentos marcados. **Motor das 5 regras `auto:appointment-*` (Fase 1).**

- `kind` CHECK in (`'consulta'`, `'procedimento'`, `'retorno'`).
- `status` CHECK in (`'agendado'`, `'realizado'`, `'cancelado'`, `'faltou'`, `'remarcado'`).
- `scheduled_at`.
- Trigger `trg_appointments_recompute` recalcula campos derivados no lead.
- Relação: **1 lead → N appointments** (P9). Card exibe próximo `agendado` mais futuro; detalhe lista todos.

### Exibição no card

| Slot | Origem |
|---|---|
| "Próximo compromisso" no header | `MIN(scheduled_at) WHERE status='agendado' AND scheduled_at > now()` |
| Lista completa | Toda `appointments WHERE lead_id = X ORDER BY scheduled_at DESC` |
| Calendário | Mesma origem, agrupada por `kind` e `professional_id` |

### Mapeamento `appointments` → ações (Fase 1)

Trigger Postgres em `INSERT OR UPDATE OF status` chama edge function `pipeline-appointment-sync`. Idempotência por `lead_events.type='appointment_status_synced'` com `payload->>'appointment_id'`.

| Evento | Regra | Ação |
|---|---|---|
| INSERT status=agendado, kind=consulta | `auto:appointment-agendado` | Mover lead → `Consulta agendada` **se stage atual ≠ `Paciente antigo`** (D3); senão só anexar tag `consulta_agendada`. |
| INSERT status=agendado, kind=procedimento | `auto:appointment-agendado` | Mover lead → `Tratamento agendado` **se stage atual ≠ `Paciente antigo`** (D3); senão só anexar tag `tratamento_em_andamento`. |
| UPDATE status→realizado, kind=consulta | `auto:appointment-realizado` | Mover → `Consulta finalizada` (respeitando guard D3). |
| UPDATE status→realizado, kind=procedimento | `auto:procedure-realizado` | Se 1ª sessão: mover → `Em tratamento` (guard D3 aplica). Senão: incrementar `custom_fields.sessoes_realizadas`, não move. |
| UPDATE status→faltou | `auto:appointment-faltou` | Mover → `Sem resposta` + tag `no_show` + task "Reagendar" D+1 (guard D3 aplica). |
| UPDATE status→cancelado | `auto:appointment-cancelado` | Mover → `Qualificação` + tag `reagendamento_pendente` + task "Oferecer novo horário" (guard D3 aplica). |

**Guard D3 explicado**: quando `current_stage = 'Paciente antigo'`, regras `auto:appointment-*` que moveriam o card abortam o move e em vez disso atualizam tags/campos. Mantém a regra "paciente antigo não sai do stage".

## Triggers de banco que já escrevem em leads (R1, R2, R3)

| Trigger | O que faz | Implicação |
|---|---|---|
| `tg_lead_risk_handler` | Injeta `risco_clinico` em `leads.tags`. | **R1**: Classifier MERGE sempre, nunca SET. |
| `trg_validate_lead_custom_fields_enums` | Valida enums implícitos. `qualificacao='desqualificado'` exige `motivo_desqualificacao`. | **R2**: Setar juntos no mesmo UPDATE. |
| `sync_lead_pipeline_id` | Deriva `pipeline_id`. | **R3**: Nunca escrever direto. |

## `lead_custom_fields`

Definição dos campos custom por clínica. Valores moram em `leads.custom_fields jsonb`.

### Hoje (10 defs, ver `CUSTOM_FIELDS_E_TAGS.md` para enum completo)

`modalidade`, `procedimento_interesse`, `profissional_preferencia`, `status_nf_reembolso`, `qualificacao`, `motivo_desqualificacao`, `tipo_atendimento`, `status_consulta`, `convenio`, `valor_combinado`.

### Fase 0.5 — campos novos (v4.1, substituindo o conjunto v3)

| Chave | Tipo | Notas |
|---|---|---|
| `status_financeiro` | text | enum `pendente \| parcial \| pago \| reembolsado \| cancelado \| isento \| nao_se_aplica`. **Substitui** a coluna "Procedimento pago" (D1). |
| `interesse_consulta` | text[] | multi: `ivan \| maisa`. **Substitui** `interesse_principal`. |
| `interesse_tratamento` | text[] | multi: `cetamina \| emt \| hipnose \| outro \| nenhum`. |
| `ciclo_concluido` | boolean | Humano marca true → `auto:ciclo-concluido` move Em tratamento → Paciente antigo. |
| `sessoes_realizadas` | number | Incrementado por `auto:procedure-realizado` em sessões subsequentes. |
| `nome_responsavel_financeiro` | text | P2 (familiar fala pelo paciente). Classifier escreve; nunca renomeia `leads.name`. |
| `possui_liminar_judicial` | boolean | C7. |
| `saldo_sessoes_pacote` | number | Manual + futura regra. |
| `pagamento_alegado_em` | timestamptz | C4 sem webhook. |
| `data_solicitacao_nf` | timestamptz | C3. |
| `modalidade_preferida` | text | enum `presencial \| online \| qualquer`. Diferente de `modalidade` (que é da consulta atual). |
| `motivo_cancelamento` | text | enum `paciente_cancelou \| clinica_cancelou \| outro`. Setado por `auto:appointment-cancelado`. |

### Novo enum `motivo_desqualificacao` (v4.1)

Substitui o conjunto v3. Novo enum:

```
servico_nao_oferecido | especialidade_nao_atendida | contato_por_engano | fora_da_regiao | demanda_incompativel | outro
```

Migration deve atualizar `trg_validate_lead_custom_fields_enums` para o novo conjunto + reconvertir valores antigos (`fora_de_escopo_geografico` → `fora_da_regiao`, `sem_fit_clinico` → `demanda_incompativel`, `sem_condicao_financeira` → `outro` com nota).

## `stage_sequence_bindings` (Fase 0)

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

## `app_settings` — toggles de automação (v4.1)

Todas as regras `auto:*` controladas por chaves `automation.<rule>.enabled`. **Off by default na Fase 0**:

```sql
INSERT INTO app_settings (key, value, scope, clinic_id) VALUES
 -- Fase 1 (sem LLM)
 ('automation.novo-lead.enabled',             'false', 'clinic', '<clinic-id>'),
 ('automation.secretary-replied.enabled',     'false', 'clinic', '<clinic-id>'),
 ('automation.appointment-agendado.enabled',  'false', 'clinic', '<clinic-id>'),
 ('automation.appointment-realizado.enabled', 'false', 'clinic', '<clinic-id>'),
 ('automation.appointment-faltou.enabled',    'false', 'clinic', '<clinic-id>'),
 ('automation.appointment-cancelado.enabled', 'false', 'clinic', '<clinic-id>'),
 ('automation.procedure-realizado.enabled',   'false', 'clinic', '<clinic-id>'),
 ('automation.followup-24h.enabled',          'false', 'clinic', '<clinic-id>'),
 ('automation.followup-3d.enabled',           'false', 'clinic', '<clinic-id>'),
 ('automation.followup-7d-nutricao.enabled',  'false', 'clinic', '<clinic-id>'),
 ('automation.reactivation.enabled',          'false', 'clinic', '<clinic-id>'),
 ('automation.modality-guard.enabled',        'false', 'clinic', '<clinic-id>'),
 ('automation.ciclo-concluido.enabled',       'false', 'clinic', '<clinic-id>'),
 ('automation.reator-humano.enabled',         'false', 'clinic', '<clinic-id>'),
 -- Fase 2 (LLM)
 ('automation.b2b-move.enabled',              'false', 'clinic', '<clinic-id>'),
 ('automation.urgency-flag.enabled',          'false', 'clinic', '<clinic-id>'),
 -- Fase 3
 ('automation.payment-confirmed.enabled',     'false', 'clinic', '<clinic-id>'),
 ('automation.nf-task.enabled',               'false', 'clinic', '<clinic-id>');
```

**Removidas em v4.1**:
- `automation.procedimento-pago.enabled` (stage não existe mais — D1).
- `automation.reminder-d1.enabled` (lembretes via UI `/automations` — D6).
- `automation.inactivity-5d.enabled` (substituída por followup tiered).

## RPCs / helpers

- `current_clinic_id()` — pega clínica do JWT.
- `manual-stage-move.ts` (frontend hook) — grava `lead_stage_history` com `source='manual'` e seta `manual_lock_until = now() + 7d`. **Reator humano lê isso.**
- `trg_appointments_recompute` — campos derivados.

## Edge functions úteis

- `evolution-webhook` — entry point WhatsApp; hook síncrono pro classifier + `auto:secretary-replied`.
- `ai-assist`, `ai-chat`, `ai-auto-reply` — Lovable AI Gateway cabeado.
- `automations-tick` — **já configurado para lembretes via UI** (D6). Não duplicar em código novo.
- `sequence-tick`, `email-automations-tick`.

## Tabelas residuais do agente antigo

- `lead_ai_settings`, `stage_ai_defaults` — vazias, referenciadas pelo agente de auto-reply. Não dropar, não reusar.

## Limites operacionais

- Sem cron jobs ativos para o pipeline hoje. Fase 1 vai reativar via `cron.schedule()`.
- Sem tabela de "regras configuráveis"; Fase 1 é hardcoded. Configurável só vem se houver 3+ regras estáveis.

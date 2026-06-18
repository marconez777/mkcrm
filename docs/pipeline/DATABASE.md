---
title: "Pipeline — Schema do banco"
topic: database
kind: reference
audience: agent
updated: 2026-06-18
summary: "Tabelas relevantes para automação do pipeline: pipelines, pipeline_stages, leads, lead_stage_history, lead_events, lead_tasks, appointments. Colunas-chave, RLS e gatilhos."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/AUTOMATION_PLAN.md
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

Colunas-chave:
- `id`, `pipeline_id`, `name`, `position`, `is_terminal`, `lock_auto_move`.
- `is_terminal=true` → não retorna ao funil (B2B, Desqualificado).
- `lock_auto_move=true` → automação NÃO move leads para esse stage (usar quando entrar regras críticas).

## `leads` (42 colunas — só as relevantes para automação)
- **Posição no funil**: `pipeline_id`, `stage_id`, `position` (ordem dentro da coluna), `stage_changed_at`.
- **Identidade**: `name`, `phone`, `email`, `clinic_id`, `whatsapp_instance_id`, `attendant_id`.
- **Estado livre**: `tags text[]`, `custom_fields jsonb` (chaves típicas: `modalidade`, `procedimento_interesse`, `profissional_preferencia`, `status_nf_reembolso`).
- **Atividade**: `last_message_at`, `last_message_preview`, `last_human_activity_at`, `last_site_activity_at`, `unread_count`.
- **Triagem IA (legado, ainda usado)**: `ai_summary`, `needs_ai_review`, `ai_review_reasons text[]`, `last_classified_at`.
- **Lock manual** ⚠️: `manual_lock_until` — automação NÃO deve mover lead até essa data passar. Setado quando humano arrasta no Kanban.
- **Origem**: `landing_page`, `utm_source/medium/campaign`, `gclid`, `fbclid`, `form_source`.
- **Flags**: `archived_at`, `pinned_at`, `marked_unread`, `is_internal_contact`.

## `lead_stage_history`
Toda movimentação **deve** ser registrada aqui. Hoje as RPC de movimentação manual já gravam.

- `lead_id`, `from_stage_id`, `to_stage_id`, `moved_at`.
- `moved_by_user_id` (humano) **ou** `moved_by_agent_id` (agente IA — FK para `ai_agents`).
- `source text` — convenção: `'manual'`, `'auto:<rule>'`, `'system:<reason>'`. Indexado.
- `reason text` — texto livre legível.
- `metadata jsonb` — payload (ex: trigger event id, confidence score).
- Dedup: índice único `(lead_id, to_stage_id, moved_at)` evita gravação dupla no mesmo ms.

## `lead_events`
Log livre de eventos por lead. Usar como **trilha de idempotência** das automações.

- `type text` — convenções sugeridas: `payment_confirmed`, `nf_solicitada`, `reminder_sent`, `inactivity_detected`, `urgency_flagged`.
- `payload jsonb`, `actor_user_id` (null se sistema).
- Indexado por `(lead_id, created_at)` e `(type, created_at)`.

## `lead_tasks`
Tarefas vinculadas ao lead (diferente de `tasks`/`task_boards` que é o Kanban de tarefas geral).

- `title`, `due_at`, `done_at`.
- Use para "Emitir NF", "Confirmar pagamento", "Follow-up liminar".
- Indexado por `due_at WHERE done_at IS NULL` — fácil consultar pendentes.

## `appointments`
Consultas e procedimentos marcados.

- `kind` CHECK in (`'consulta'`, `'procedimento'`, `'retorno'`).
- `status` CHECK in (`'agendado'`, `'realizado'`, `'cancelado'`, `'faltou'`, `'remarcado'`).
- `scheduled_at`.
- Tem trigger `trg_appointments_recompute` que recalcula campos derivados no lead.
- Fonte primária para lembretes D-1 e para o cenário C8 (renovação de receita: olhar `MAX(scheduled_at) WHERE kind='consulta' AND status='realizado'`).

## `lead_internal_notes`
Notas internas (não vão para o paciente). Use para deixar rastro humano-legível quando uma automação tomar decisão importante.

## `lead_custom_fields`
Definição dos campos custom por clínica (schema). Os valores moram em `leads.custom_fields jsonb`.

## Tabelas residuais do agente antigo (vazias, mantidas para auth/inbox)

- `lead_ai_settings` — vazia, recriada sem lógica de pipeline.
- `stage_ai_defaults` — vazia, recriada sem lógica de pipeline.

> Não foram dropadas porque o **agente de auto-reply do WhatsApp** ainda referencia esses nomes em algumas rotas. Tratar como "reservadas, ignorar".

## RPCs / triggers já existentes (não reescrever)

- `current_clinic_id()` — pega clínica do usuário/JWT atual; toda RLS depende disso.
- Movimentação manual passa por hook frontend `manual-stage-move.ts` que grava em `lead_stage_history` com `source='manual'` e seta `manual_lock_until`.
- `trg_appointments_recompute` — não precisa fazer nada manual quando criar/mudar appointment, os campos derivados no lead são atualizados.

## Edge functions disponíveis (úteis para automação futura)

- `automations-tick`, `sequence-tick`, `email-automations-tick` — exemplos de cron-driven ticks que podem ser usados como template.
- `transcribe-audio` — caso precise classificar áudios de novo.
- `evolution-webhook` — entry point das mensagens de WhatsApp; bom ponto para gatilho síncrono de regras.
- `ai-assist`, `ai-chat`, `ai-auto-reply` — IA já cabeada com Lovable AI Gateway.

## Limites operacionais

- Sem cron jobs ativos para o pipeline hoje (foram removidos). Reativar via `cron.schedule()` em migration quando criar nova tick function.
- Não há tabela de "regras" do pipeline (`pipeline_field_rules` foi dropada). Se quiser regras configuráveis pelo usuário, **criar nova tabela** — não reusar o nome antigo.

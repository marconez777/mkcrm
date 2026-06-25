
# Plano: `skill-datas.md` — Auditoria de Datas, Agendamentos, Lembretes e Custom Fields

Vou produzir **um único arquivo** (`docs/skill-datas.md`) consolidando, em profundidade, todo o conhecimento do sistema sobre agendamentos, datas e custom fields. Esse arquivo servirá como material de apoio para as próximas adaptações.

## Escopo da auditoria

Vou cobrir, ponta a ponta:

1. **Modelo de dados (Postgres / Lovable Cloud)**
   - Tabelas: `appointments`, `appointment_service_types`, `leads`, `lead_custom_fields`, `lead_stage_history`, `pipeline_stages`, `automations`, `automation_runs`, `scheduled_messages`, `message_sequence_*`, `tasks`/`lead_tasks`.
   - Colunas-chave em `leads`: `consulta_agendada_em`, `procedimento_agendado_em`, `last_*_at`, `custom_fields` (jsonb).
   - Tipos de campo em `lead_custom_fields` (`date`, `boolean`, `select`, `text`, etc.) e como cada um é persistido em `leads.custom_fields`.
   - RLS, GRANTs e triggers (`net.http_request_queue`, `processLeadEvent`).
   - Migrations mais recentes relevantes (`20260622…`, `20260618…`, `20260624180427` da transição humana).

2. **Frontend**
   - `src/pages/SettingsCustomFields.tsx` — criação/edição de campos.
   - `src/pages/SettingsAppointmentTypes.tsx` + `useServiceTypes` + `service-types-mutations` — tipos de serviço/consulta.
   - `src/components/kanban/calendar/PipelineCalendar.tsx` + `AppointmentDialog.tsx` + `useAppointments` + `appointments-mutations.ts` — agenda da clínica.
   - `src/components/inbox/CustomFieldsPanel.tsx` + `ContextRail.tsx` — edição manual de campos no lead.
   - `src/pages/Automations.tsx` — UI de automações `before_appointment` / `date_reminder` / condições por custom field (recente).
   - `src/pages/Kanban.tsx`, `MoveLeadDialog.tsx`, `manual-stage-move.ts` — interação com estágios de agendamento.
   - `src/lib/template-vars.ts` — variáveis `{{consulta_data}}`, `{{procedimento_data}}`, etc.
   - `src/hooks/useCustomFieldDefs.ts`.

3. **Backend / Edge Functions**
   - `supabase/functions/automations-tick/index.ts` — gatilhos `before_appointment`, `date_reminder`, condição por `custom_fields`, `normBool`.
   - `supabase/functions/sequence-tick/index.ts`.
   - `supabase/functions/pipeline-classify/` (`apply.ts`, `agent-core.ts`, `date-parser.ts`, `schema.ts`, `context.ts`) — `HUMAN_SCHEDULING_FIELDS`, `HUMAN_SCHEDULING_STAGES`, bloqueios da IA, parser de datas PT-BR.
   - `supabase/functions/pipeline-deterministic/index.ts` — `ruleFieldChanged` (auto-move ao preencher data), `ruleConsultaPassou` (desabilitada).
   - `supabase/functions/pipeline-position-auditor/index.ts` — A1 alinhado à transição humana.
   - `supabase/functions/_shared/pipeline-move.ts`, `pipeline-tasks.ts`, `pipeline-fase4.ts`, `template-vars.ts`.
   - `supabase/functions/outreach-recovery-tick`, `pipeline-payment-webhook`, `forms-ingest`, `external-lead-capture` (como escrevem datas/custom fields).

4. **Pipeline / Estágios**
   - Estágios `Consulta agendada`, `Consulta finalizada`, `Procedimento agendado`, `Procedimento pago`, `Fechamento pendente consulta/procedimento`, `Retorno`.
   - Regras determinísticas: campo preenchido → move estágio (`auto:field-changed-consulta`/`procedimento`).
   - O que a IA NÃO pode mais fazer (transição 100% humana de jun/2026).

5. **Automações & Lembretes**
   - Triggers existentes: `before_appointment`, `date_reminder`, `stage_entered`, `inactivity`, `field_changed`.
   - Como `before_appointment` calcula `next_run` a partir de `consulta_agendada_em` / `procedimento_agendado_em`.
   - Condição por custom field (`field_key` / `op` / `value`) — caso teleconsulta vs presencial.
   - Templates, `template_vars`, expansão de variáveis de data, fuso horário/format.
   - `automation_runs` (status `condition_not_matched`, `sent`, `skipped`).
   - `scheduled_messages` e `message_sequences` (lembretes encadeados).

6. **Custom Fields**
   - Definição (`lead_custom_fields`): `key`, `label`, `field_type`, `options`, `required`, `order`.
   - Onde são preenchidos: Inbox (`CustomFieldsPanel`), Kanban, IA (com restrições), forms (`forms-ingest`), webhooks externos.
   - Onde são lidos: automações, sequences, templates (`{{cf.<key>}}`), auditor, classifier.
   - Convenções de chave (`teleconsulta`, `cidade`, etc.), normalização booleana.

7. **Documentação existente** (vou citar e referenciar inline, não duplicar)
   - `docs/pipeline/CALENDAR.md`, `CALENDAR_PLAN.md`
   - `docs/pipeline/AUTOMATION_PLAN.md`
   - `docs/pipeline/CUSTOM_FIELDS_E_TAGS.md`
   - `docs/pipeline/runtime/USER_AUTOMATIONS.md`, `DETERMINISTIC_RULES.md`, `FIELDS_LIVE.md`, `STAGES_LIVE.md`, `FLOW_MATRIX.md`, `KNOWN_ISSUES.md`, `TRIGGERS_AUDIT.md`, `CLASSIFIER.md`, `AUDITORS.md`.
   - `docs/estudo/03-consulta-agendada.md`, `05-consulta-finalizada.md`, `10-procedimento-agendado.md`, `13-antigo-consultaprocedimento-agendado.md`, `clinica-or-fluxo-novo.md`.
   - `.lovable/memories/docs/maintenance-progress.md`.

## Estrutura do `docs/skill-datas.md`

```text
1. Visão geral e princípios atuais (transição humana jun/2026)
2. Glossário de campos de data e estágios
3. Modelo de dados
   3.1 leads (colunas de data + custom_fields jsonb)
   3.2 appointments + appointment_service_types
   3.3 lead_custom_fields (definições)
   3.4 automations + automation_runs
   3.5 scheduled_messages + message_sequences
   3.6 lead_stage_history / pipeline_stages
4. Fluxo de agendamento (consulta e procedimento)
   4.1 Como o card chega em "agendada"
   4.2 Regra determinística field_changed (auto-move)
   4.3 O que a IA pode/não pode fazer (HUMAN_SCHEDULING_*)
   4.4 Transição finalização / retorno
5. Calendário (PipelineCalendar + AppointmentDialog)
6. Custom Fields
   6.1 Tipos suportados e UI
   6.2 Persistência (lead_custom_fields vs leads.custom_fields)
   6.3 Normalização (boolean, select, date)
   6.4 Uso em templates / automações / IA
7. Automações de lembrete
   7.1 Triggers (lista completa + payload)
   7.2 before_appointment (cálculo de next_run, fuso, janelas)
   7.3 date_reminder (campos custom de data)
   7.4 Condições por custom field (teleconsulta etc.)
   7.5 Templates e variáveis de data
   7.6 Logs (automation_runs) e diagnóstico
8. Parser de datas PT-BR (date-parser.ts)
9. Integrações de entrada que escrevem datas/custom fields
10. Convenções, invariantes e armadilhas
11. Pontos de extensão / hooks para próximas adaptações
12. Índice cruzado: arquivo → responsabilidade (com file:line)
```

Cada seção terá referências `arquivo:linha` para o agente futuro abrir direto. Vou listar **todas** as edge functions, hooks, componentes e migrations encontrados — sem omitir.

## Entregável

- Novo arquivo: `docs/skill-datas.md` (~estimado 800–1200 linhas markdown).
- Sem alterações em código.
- Sem alterações em outras docs (apenas referências).

Após aprovação, executo a leitura profunda dos arquivos listados e gero o documento em uma passada.

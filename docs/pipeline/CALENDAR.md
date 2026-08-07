---
title: "Mapa — Módulo Calendário do Pipeline"
topic: kanban
kind: map
audience: agent
updated: 2026-06-22
summary: "Mapa do módulo Calendário do Pipeline: tabelas, hooks, componentes, rotas, mutations e invariantes."
code_refs:
  - src/components/kanban/calendar/
  - src/hooks/useAppointments.ts
  - src/hooks/useServiceTypes.ts
  - src/hooks/useLeadSearch.ts
  - src/lib/appointments-mutations.ts
  - src/lib/service-types-mutations.ts
  - src/pages/SettingsAppointmentTypes.tsx
  - src/components/settings/ServiceTypeDialog.tsx
  - src/pages/Kanban.tsx
related_docs:
  - docs/pipeline/CALENDAR_PLAN.md
  - docs/pipeline/runtime/TRIGGERS_AUDIT.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
---

# Mapa — Módulo Calendário do Pipeline

Visão de calendário (mês/semana/dia) dentro do contexto de cada pipeline. Eventos = `appointments` filtrados por `leads.pipeline_id`. Drag & drop atualiza `scheduled_at`/`duration_min`; mudanças de status disparam sync com a stage do lead.

Entregue em 2026-06-22 (PRs 11.1 → 11.8).

## 1. Banco

### Tabela `appointment_service_types`
Catálogo por clínica. Colunas: `id, clinic_id, kind ('consulta'|'procedimento'|'retorno'), slug, label, color_hex, default_duration_min, active, position`. `UNIQUE(clinic_id, kind, slug)`. RLS por `clinic_id`. Realtime habilitado.

### Tabela `appointments` (colunas relevantes)
`service_type_id uuid` (FK opcional), `duration_min int default 30`, `end_at` (`GENERATED ALWAYS AS scheduled_at + duration_min*'1 min'`). Demais colunas pré-existentes.

### Triggers (ver TRIGGERS_AUDIT §2)
- `tg_appointments_recompute` — AFTER INS/UPD/DEL: recalcula `consulta_agendada_em` / `procedimento_agendado_em` em `leads.custom_fields`. Chip do card no Kanban é reativo.
- `trg_appointments_auto_sync` — AFTER UPDATE OF `status`: chama edge `pipeline-deterministic {action:'appointment-sync'}`, que move o card para a stage canônica. **Drag & resize não disparam** (só mudam `scheduled_at`/`duration_min`).

## 2. Hooks

| Hook | Arquivo | Responsabilidade |
|---|---|---|
| `useServiceTypes()` | `src/hooks/useServiceTypes.ts` | Catálogo `active=true`, ordenado por `kind, position`, com realtime. Usado pelo calendário e pelo dialog. |
| `useAppointments({ pipelineId, from, to })` | `src/hooks/useAppointments.ts` | Lista de `appointments` no range, joinada com `leads!inner(pipeline_id, name, stage_id)`. Realtime com debounce 200ms. Exporta `appointmentToEvent()` (cor por service_type + opacidade por status). |
| `useLeadSearch(pipelineId, query)` | `src/hooks/useLeadSearch.ts` | Busca leve por nome (`ilike`, limit 20), com debounce 200ms. Alimenta o combobox de lead ao criar agendamento. |

## 3. Mutations

### `src/lib/appointments-mutations.ts`
- `createAppointment(input)` — resolve `clinic_id` via `leads.clinic_id` e insere com `status='agendado'`.
- `updateAppointment(id, patch)` — patch parcial (kind, service_type_id, scheduled_at, duration_min, notes).
- `updateAppointmentSchedule(id, scheduled_at, duration_min?)` — usado pelo drag/resize do FullCalendar.
- `updateAppointmentStatus(id, status)` — `realizado | cancelado | faltou | remarcado | agendado`.
- `deleteAppointment(id)`.

### `src/lib/service-types-mutations.ts`
- `createServiceType(input)` — calcula `position = max+1` por `(clinic_id, kind)`. Slug auto-gerado se vazio.
- `updateServiceType(id, patch)`.
- `deleteServiceType(id)` — trata `23503` (FK em uso) com mensagem "Desative em vez de excluir".
- `swapServiceTypePositions(a, b)` — duas updates sequenciais (não há UNIQUE em position).
- `slugify(text)`.

## 4. UI

| Componente | Arquivo | Notas |
|---|---|---|
| `PipelineCalendar` | `src/components/kanban/calendar/PipelineCalendar.tsx` | FullCalendar (`timeGridWeek` default), `slotDuration=30m`, `snapDuration=15m`, locale pt-BR, TZ America/Sao_Paulo, `selectable`, `editable`. Abre `AppointmentDialog` em create/edit. |
| `CalendarLegend` | `src/components/kanban/calendar/CalendarLegend.tsx` | Legenda de cores por service_type. |
| `CalendarSheet` | `src/components/kanban/calendar/CalendarSheet.tsx` | Sheet fullscreen aberto pelo botão Calendário no header do Kanban. |
| `AppointmentDialog` | `src/components/kanban/calendar/AppointmentDialog.tsx` | Create (lead combobox + tipo + serviço + data/hora + duração + notas) e Edit (mesmo form + botões realizado/faltou/cancelado/excluir). Só editável quando `status='agendado'`. |
| `SettingsAppointmentTypes` | `src/pages/SettingsAppointmentTypes.tsx` | Lista por kind; reordenar com setas; criar/editar/desativar/excluir. |
| `ServiceTypeDialog` | `src/components/settings/ServiceTypeDialog.tsx` | Form do catálogo. |

Kanban: botão Calendário no header (`src/pages/Kanban.tsx`) abre `CalendarSheet` para o pipeline atual.

## 5. Rotas

- `/settings/appointment-types` — página dedicada.
- Aba "Tipos de agendamento" em `/settings` traz um atalho.

## 6. Invariantes (não quebrar)

- **Edição condicional ao status:** `appointmentToEvent` define `editable = (status === "agendado")`. Concluídos/cancelados/faltou/remarcado são imóveis no calendário.
- **`service_type_id` é opcional.** Sem ele, a cor cai para `#3b82f6` e o label vira o próprio `kind`.
- **`clinic_id` nunca vem do form.** Sempre derivado: em `appointments` via `leads.clinic_id`, em `appointment_service_types` via `membership.clinic_id`.
- **Sem `refetch` manual** após mutations — `useAppointments` e `useServiceTypes` têm realtime.
- **Drag/resize ≠ status.** Só `updateAppointmentStatus` aciona `trg_appointments_auto_sync` → reposicionamento do card no Kanban.
- **Reordenar tipos** usa `swapServiceTypePositions` (duas updates). Colisões são improváveis pois não há UNIQUE em `(clinic_id, kind, position)`.

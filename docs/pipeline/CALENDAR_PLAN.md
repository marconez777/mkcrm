---
title: "Plano — Calendário de Agendamentos por Pipeline"
topic: kanban
kind: roadmap
audience: agent
updated: 2026-06-22
summary: "Planejamento do módulo de Calendário acessível dentro de cada pipeline, com drag-and-drop de horários, tipos de evento (consulta psi/psicólogo, EMT, Cetamina) e sincronia bidirecional com cards do Kanban."
code_refs:
  - src/pages/Kanban.tsx
  - src/components/kanban/
  - supabase/functions/pipeline-deterministic/
  - supabase/migrations/20260617210036_3d27aae0-917b-48ee-849d-d18655543991.sql
related_docs:
  - docs/pipeline/CALENDAR.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/runtime/STAGES_LIVE.md
  - docs/pipeline/runtime/TRIGGERS_AUDIT.md
---

> **Status: ENTREGUE em 2026-06-22.** PR11.1 schema · PR11.2 hooks/realtime · PR11.3 `PipelineCalendar` · PR11.4 botão + sheet · PR11.5 drag & resize · PR11.6 `AppointmentDialog` · PR11.7 `SettingsAppointmentTypes` · PR11.8 docs. Ver mapa vivo em `docs/pipeline/CALENDAR.md`.

# Calendário de Agendamentos por Pipeline

## 1. Objetivo

Dar à secretária uma visão de calendário (mês / semana / dia) **dentro do contexto do pipeline**, onde cada appointment aparece como evento. Mover/redimensionar o evento ⇒ atualiza `scheduled_at` no banco ⇒ trigger já existente recomputa `consulta_agendada_em`/`procedimento_agendado_em` ⇒ chip do card no Kanban atualiza automaticamente.

## 2. Infra já pronta (não recriar)

| Item | Onde | Observação |
|---|---|---|
| Tabela `appointments` | mig `20260617210036` | `id, clinic_id, lead_id, kind, scheduled_at, status, notes, created_by`. RLS por `clinic_id` ✅. |
| Recompute de chips | `recompute_lead_appointment_summary()` + `tg_appointments_recompute` | Após qualquer INSERT/UPDATE/DELETE em `appointments`, atualiza `leads.custom_fields.consulta_agendada_em` / `procedimento_agendado_em`. **Nada a fazer no frontend.** |
| Sync de stage | `trg_appointments_auto_sync` → `pipeline-deterministic` (`appointment-sync`) | Mudança de `status` move o card para a stage canônica certa. PR10.3 já limpa `reagendamento_*` ao reagendar. |
| Chips do card | `src/pages/Kanban.tsx` (~L300-320) | Lê `consulta_agendada_em` / `procedimento_agendado_em` do `custom_fields`. Já reativo. |

## 3. Lacunas a cobrir

1. **Falta "tipo de serviço"** — `appointments.kind` só tem `consulta|procedimento|retorno`. Precisamos diferenciar **consulta com psiquiatra vs. psicólogo** e **procedimento EMT vs. Cetamina** (e expansível).
2. **Falta UI de calendário** — não existe tela. Hoje appointments são criados implicitamente pelo classifier / manual via SQL.
3. **Falta CRUD UI** — criar, mover (drag & drop), redimensionar, cancelar, marcar realizado/faltou.
4. **Falta escopo por pipeline** — `appointments` hoje é por clínica, não por pipeline. Precisamos filtrar pelos leads do pipeline atual.

## 4. Modelo de dados — mudanças

### 4.1 Nova tabela `appointment_service_types`
Catálogo configurável por clínica (admin pode adicionar/editar).

```text
appointment_service_types
  id            uuid pk
  clinic_id     uuid fk clinics
  kind          text  -- 'consulta' | 'procedimento' | 'retorno'  (FK lógica para appointments.kind)
  slug          text  -- 'psi', 'psicologo', 'emt', 'cetamina', 'retorno_30d', …
  label         text  -- "Consulta com Psiquiatra"
  color_hex     text  -- "#3b82f6" (para o evento no calendário)
  default_duration_min  int default 60
  active        boolean default true
  position      int
  UNIQUE(clinic_id, kind, slug)
```

Seeds iniciais para ÓR:
- `consulta / psi  → "Consulta com Psiquiatra"`
- `consulta / psicologo → "Consulta com Psicólogo"`
- `procedimento / emt → "Sessão EMT"`
- `procedimento / cetamina → "Sessão Cetamina"`
- `retorno / retorno → "Retorno"`

### 4.2 Colunas novas em `appointments`

```sql
ALTER TABLE public.appointments
  ADD COLUMN service_type_id uuid REFERENCES public.appointment_service_types(id),
  ADD COLUMN duration_min    int NOT NULL DEFAULT 60,
  ADD COLUMN end_at          timestamptz GENERATED ALWAYS AS (scheduled_at + (duration_min || ' minutes')::interval) STORED;

CREATE INDEX idx_appointments_clinic_range ON public.appointments(clinic_id, scheduled_at, end_at);
```

Trigger `tg_appointments_recompute` permanece intacto — depende só de `scheduled_at`/`status`/`kind`.

### 4.3 Filtro por pipeline

O calendário do pipeline X mostra apenas appointments de leads cujo `leads.pipeline_id = X`. Consulta com `INNER JOIN leads`.

## 5. Backend — endpoints

Tudo via PostgREST direto (RLS já cobre). **Nenhuma edge function nova obrigatória.**

| Ação | SQL |
|---|---|
| Listar eventos de um pipeline em janela | `select a.*, l.name from appointments a join leads l on l.id=a.lead_id where l.pipeline_id=$1 and a.scheduled_at >= $from and a.scheduled_at < $to` |
| Criar | `insert into appointments(lead_id, kind, service_type_id, scheduled_at, duration_min, notes)` |
| Mover (drag) | `update appointments set scheduled_at=$new where id=$id` |
| Redimensionar | `update appointments set duration_min=$min where id=$id` |
| Cancelar / realizar / faltou | `update appointments set status=$s where id=$id` |

Mudar `status` dispara `trg_appointments_auto_sync` → muda stage. Mudar `scheduled_at` dispara `tg_appointments_recompute` → atualiza chip.

## 6. Frontend — UI

### 6.1 Lib de calendário
Adotar **FullCalendar React** (`@fullcalendar/react` + `daygrid`, `timegrid`, `interaction`). Justificativa:
- Drag & drop e resize prontos (interaction plugin).
- Vistas mês / semana / dia.
- Time slots, eventos coloridos, fuso BRT.
- Free (MIT) para os plugins que usamos.

`react-day-picker` (já no projeto) **não** atende — é só date picker.

### 6.2 Rota e botão

- Botão **Calendário** ao lado de `PipelineSwitcher` no header (`src/pages/Kanban.tsx` ~L806).
- Rota nova: `/pipeline/:pipelineId/calendar` (ou drawer fullscreen — decisão na PR1, drawer é mais rápido).
- Página nova: `src/pages/kanban/PipelineCalendar.tsx`.

### 6.3 Componentes novos

```text
src/components/kanban/calendar/
  PipelineCalendar.tsx          ← shell, view switcher, filtros
  AppointmentEvent.tsx          ← render do evento (cor por service_type, badge kind)
  AppointmentDialog.tsx         ← criar/editar (lead picker, service_type, data, hora, duração, status, notas)
  CalendarLegend.tsx            ← legenda colorida por service_type
  useAppointments.ts            ← hook: fetch range + realtime channel
  useServiceTypes.ts            ← hook: catálogo cacheado
```

### 6.4 Realtime

Habilitar realtime na `appointments` (`ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments`). Hook `useAppointments` faz `supabase.channel().on('postgres_changes', { table: 'appointments', filter: 'clinic_id=eq.X' })` e reinvalida.

### 6.5 Admin: gerenciar tipos de serviço

Página em `src/pages/SettingsAppointmentTypes.tsx` (link em Settings) com CRUD simples sobre `appointment_service_types`.

## 7. Sincronia bidirecional — fluxo

```text
[Calendário]                        [Kanban]
secretária arrasta evento           card mostra chip antigo
   │                                       ▲
   ▼                                       │
UPDATE appointments                  re-render via realtime/refetch
SET scheduled_at = novo              │
   │                                       │
   ▼                                       │
tg_appointments_recompute       leads.custom_fields.{consulta,procedimento}_agendada_em
   └─────────────────────────────────────┘

secretária marca "realizado"
   │
   ▼
UPDATE appointments SET status='realizado'
   ├─► tg_appointments_recompute (limpa chip)
   └─► trg_appointments_auto_sync → pipeline-deterministic
                                    → move stage para "Consulta finalizada"/"1ª Sessão Finalizada"
```

## 8. PRs propostos (ordem)

| PR | Escopo | Saída |
|---|---|---|
| **PR11.1** | Migration: `appointment_service_types` + seeds ÓR + colunas em `appointments` (`service_type_id`, `duration_min`, `end_at`) | schema pronto |
| **PR11.2** | Realtime em `appointments` + hooks `useAppointments`, `useServiceTypes` | dados reativos |
| **PR11.3** | Componente `PipelineCalendar` (mês/semana/dia, somente leitura, eventos coloridos por service_type) | tela navegável |
| **PR11.4** | Botão "Calendário" no header do Kanban + rota `/pipeline/:id/calendar` | acesso |
| **PR11.5** | Drag & drop + resize (atualiza `scheduled_at`/`duration_min`) | edição inline |
| **PR11.6** | `AppointmentDialog` (criar/editar/cancelar/realizar/faltou) | CRUD completo |
| **PR11.7** | `SettingsAppointmentTypes` (admin do catálogo) | gestão de tipos |
| **PR11.8** | Docs: atualizar `docs/pipeline/runtime/TRIGGERS_AUDIT.md`, criar `docs/maps/CALENDAR.md`, rodar `docs-sync` | drift zero |

## 9. Riscos e mitigações

- **Drag em evento "realizado"** — bloquear no UI (só permitir drag se `status='agendado'`).
- **Conflito com mudança de stage manual** — `trg_appointments_auto_sync` só dispara em UPDATE OF status. Mudar apenas `scheduled_at` não move card (correto).
- **Timezone** — armazenar sempre UTC (`timestamptz`); renderizar em America/Sao_Paulo no FullCalendar via `timeZone="America/Sao_Paulo"`.
- **Performance em janela grande** — index `idx_appointments_clinic_range` cobre `(clinic_id, scheduled_at, end_at)`; fetch limitado a `[start_of_view, end_of_view]`.

## 10. Decisões em aberto

1. **Rota vs Drawer fullscreen** — rota dedicada permite link compartilhável; drawer é mais rápido de fechar.
2. **Bloqueio de conflito de horário** (dois appointments mesmo profissional/sala) — fora de escopo agora; precisaria de `resources` (profissionais/salas) numa próxima fase.
3. **Notificação WhatsApp ao mover** — automático ou manual? Default proposto: manual (botão no dialog dispara template).

## 11. Próximo passo
Aprovar plano e abrir **PR11.1** (schema).

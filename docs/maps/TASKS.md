---
title: "Mapa — Tasks (board Kanban + tarefas por lead)"
topic: operations
kind: map
audience: agent
updated: 2026-07-01
summary: "Sistema de tarefas dual: board Kanban global (task_boards → task_columns → tasks + assignees/checklist/labels/attachments) em /tasks, e painel de tarefas por lead (lead_tasks) no Inbox. Sem trigger de automação — apenas UI + drag/drop."
code_refs:
  - src/pages/Tasks.tsx
  - src/lib/tasks-board.ts
  - src/components/tasks/TaskDetailDialog.tsx
  - src/components/inbox/LeadTasksPanel.tsx
  - src/components/inbox/ScheduledMessagesPanel.tsx
  - src/components/inbox/ScheduleMessageDialog.tsx
  - supabase/functions/scheduled-dispatcher/
related_docs:
  - docs/maps/INBOX_KANBAN_LEADS.md
  - docs/maps/AUTOMATIONS.md
---

# Tasks — Board global + tarefas por lead

## 1. Sistema DUAL — não confundir

| Sistema | Tabela | Escopo | UI |
|---|---|---|---|
| **Task Board (Kanban)** | `tasks` + `task_boards/columns/labels/label_links/assignees/checklist_items/attachments` | Board organizacional por clínica. Múltiplos boards. | `/tasks` — `src/pages/Tasks.tsx` (358 LOC) |
| **Lead Tasks** | `lead_tasks` (7 col) | Pendências vinculadas a UM lead. | `src/components/inbox/LeadTasksPanel.tsx` (78 LOC) no ContextRail |
| **Scheduled Messages** | `scheduled_messages` (9 col) | Mensagem WhatsApp agendada para lead+data. | `ScheduledMessagesPanel` + `ScheduleMessageDialog` no Inbox |

## 2. Task Board — modelo (7 tabelas)

| Tabela | Papel |
|---|---|
| `task_boards` (5 col) | Boards por clínica, `name`, `position`. `ensureDefaultBoard()` cria "Geral" com 3 colunas padrão. |
| `task_columns` (6 col) | Colunas com `name`, `position`. |
| `tasks` (11 col) | `title`, `description`, `column_id`, `board_id`, `position`, `due_at`, `done_at`. |
| `task_assignees` (4 col) | N:N tasks × `attendants`. |
| `task_labels` (6 col) | Etiquetas coloridas. |
| `task_label_links` (3 col) | N:N tasks × labels. |
| `task_checklist_items` (7 col) | Checklist ordenado por task. |
| `task_attachments` (8 col) | Anexos (link para Storage). |

Helpers em `src/lib/tasks-board.ts` (176 LOC): `listColumns/listTasks/createTask/moveTask/updateTask/deleteColumn/listAssignees/listChecklist/toggleCheck/...`.

## 3. Frontend — `/tasks` (`src/pages/Tasks.tsx`, 358 LOC)

- Kanban com `@dnd-kit/core` — drag task entre colunas (`moveTask`), drag colunas (reorder).
- `CardItem` mostra:
  - Título + due badge (com `overdue` em vermelho se `due_at < now && !done_at`).
  - Progresso do checklist (`checkedCount / total`).
  - Avatares dos `assignees` (via `useClinicTeam` → `attendants`).
- `TaskDetailDialog` (338 LOC) abre no click: edita título/descrição, `due_at`, checklist inline, assignees, labels, attachments.
- Sem trigger de automação — puramente organizacional.

## 4. Lead Tasks — `lead_tasks` (7 col)

Campos: `lead_id`, `clinic_id`, `title`, `due_at`, `done_at`, `created_by`, `created_at`.

- Painel no `ContextRail` do Inbox — quick-add + checkbox pra marcar `done_at`.
- Sem checklist, assignees ou labels — modelo simples.
- **Sem cron** — não notifica sozinho quando vence. UI destaca vencidas em vermelho.

## 5. Scheduled Messages — `scheduled_messages` (9 col)

Campos: `lead_id`, `clinic_id`, `content`, `send_at`, `status` (`pending|sent|failed`), `sent_at`, `last_error`, `created_by`.

- `ScheduleMessageDialog` cria linha com `status='pending'` e `send_at` futuro.
- `ScheduledMessagesPanel` lista pending/failed do lead com opção de cancelar.
- Motor: **`scheduled-dispatcher`** (274 LOC) — cron 1min.
  - Fetcha até 50 `pending` com `send_at <= now`, filtra clínicas pausadas.
  - `pmap(items, 10, ...)` — paralelismo 10.
  - Chama `evolution-send` → marca `sent` (com `sent_at`) ou `failed` (com `last_error`).
- Mesmo dispatcher também processa **`pending_replies`** (auto-reply debouncer da IA — ver `docs/maps/AI_AGENTS.md`). Loss-protection: claim `pending → processing` antes de invocar, unclaim com backoff exponencial em falha, `MAX_ATTEMPTS=3`.

## 6. Invariantes

1. `task_boards` / `lead_tasks` / `scheduled_messages` são **3 sistemas isolados** — não misturar.
2. Reorder de colunas/tasks atualiza `position` (não `created_at`).
3. `scheduled-dispatcher` respeita `automations-paused` — clínica pausada não dispara agendadas.
4. Cancelar `scheduled_messages` = `DELETE` (não status). Após envio, row permanece com `status='sent'` para audit.
5. `pending_replies` NUNCA é deletado antes de sucesso — sempre CLAIM → sucesso deleta.
6. `lead_tasks.done_at` marca conclusão — não deletar completed (audit).

## 7. Débitos técnicos

- Sem notificação/cron para `lead_tasks` vencidas.
- Task Board não tem filtros (assignee, label, due).
- `scheduled_messages` não suporta mídia nem template render.
- Falta UI para "reagendar" um `failed` scheduled_message.
- `lead_tasks` não aparece no Task Board (dois mundos separados).

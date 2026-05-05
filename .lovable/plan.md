## Quadro de Tarefas estilo Trello

Transformar `/tarefas` numa board Kanban dedicada (separada do `lead_tasks`, que continua atrelado a leads). As tarefas do quadro são independentes — não exigem lead.

### Estrutura visual
- Layout horizontal com colunas roláveis (mesmo padrão visual do Pipeline atual, reaproveitando estilos).
- Cada coluna: título editável inline, contador, menu (renomear/excluir), botão "+ Adicionar um cartão".
- Cartão exibe: bolinha de status, título, badge de prazo (verde/vermelho se atrasado), avatares dos responsáveis, ícone de checklist (ex: 2/6) e ícone de descrição se houver.
- Drag-and-drop entre colunas e reordenação dentro da coluna (dnd-kit, igual ao Pipeline).
- Clique no cartão abre um Dialog grande com:
  - Título editável
  - Status concluído (check verde no topo)
  - Descrição (textarea com auto-save)
  - Data de entrega (date+time picker) com badge "Concluído" quando marcado
  - Membros (multi-select dos `attendants`) com avatares
  - Etiquetas coloridas (multi-select)
  - Checklist (itens marcáveis, adicionar/remover)
  - Botão excluir cartão

### Banco de dados (nova migração)
Novas tabelas, isoladas das `lead_tasks` existentes:

- `task_boards` — `id`, `name`, `position`, `created_at`. Criar 1 board "Geral" por padrão.
- `task_columns` — `id`, `board_id`, `name`, `position`, `created_at`.
- `tasks` — `id`, `board_id`, `column_id`, `title`, `description`, `due_at` (nullable), `done_at` (nullable), `position`, `created_at`, `updated_at`.
- `task_assignees` — `task_id`, `attendant_id` (PK composta).
- `task_labels` — `id`, `board_id`, `name`, `color`.
- `task_label_links` — `task_id`, `label_id`.
- `task_checklist_items` — `id`, `task_id`, `text`, `done`, `position`.

RLS: `authenticated_all` (mesmo padrão das outras tabelas do projeto).
Realtime habilitado nas tabelas principais (`tasks`, `task_columns`, `task_checklist_items`, `task_assignees`).

### Frontend
- Novo `src/lib/tasks-board.ts` com CRUD das entidades acima.
- Reescrever `src/pages/Tasks.tsx` como board:
  - Hook que carrega colunas + tasks + assignees + checklists do board ativo.
  - Subscrição realtime para refletir mudanças.
  - Componentes: `TaskColumn`, `TaskCard`, `TaskDetailDialog`.
- Reaproveitar componentes shadcn já existentes (`Dialog`, `Popover`, `Calendar`, `Checkbox`, `Avatar`, `DropdownMenu`).
- Selector de board no topo (caso futuramente queira múltiplos quadros), começando com 1.

### Detalhes técnicos
- Cores das etiquetas: usar tokens semânticos do design system (HSL via `index.css`).
- Drag-and-drop com `@dnd-kit/core` + `@dnd-kit/sortable` (já no projeto).
- Reordenação grava `position` em batch (estratégia de gap igual ao Pipeline).
- Avatares dos responsáveis usam cor do `attendants.color`.
- Badge de prazo: verde se hoje/futuro, vermelho se vencido, cinza se concluído.

### Fora do escopo
- Não mexer em `lead_tasks` (continua sendo o "follow-up por lead" no inbox).
- Não há anexos (pode entrar em iteração futura).
- Sem votos, sem capa, sem múltiplos boards na primeira entrega.

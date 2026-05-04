## Editar e excluir colunas do pipeline

Adicionar um menu de ações em cada coluna do Kanban para **renomear**, **trocar cor** e **excluir** etapas.

### UX

Na header de cada coluna, ao lado do botão "colapsar", um botão `⋮` (MoreVertical) abre um dropdown com:
- **Renomear** — abre dialog com input de nome
- **Mudar cor** — abre o mesmo dialog mostrando 8 swatches de cor + input hex
- **Excluir** — confirma; bloqueia exclusão se houver leads na coluna (sugere mover antes)

Na versão **colapsada** da coluna o menu também aparece (botão pequeno embaixo do nome).

### Detalhes técnicos

- Novo componente `src/components/kanban/EditStageDialog.tsx`:
  - Props: `stage`, `open`, `onOpenChange`
  - Campos: `name`, `color` (palette: indigo, sky, emerald, amber, rose, violet, slate, pink — todos via tokens HSL ou hex)
  - Botão "Salvar" → `supabase.from("pipeline_stages").update({ name, color }).eq("id", stage.id)`

- Em `src/pages/Kanban.tsx`:
  - `Column` recebe novas props `onEdit(stage)` e `onDelete(stage)`
  - Adiciona `<DropdownMenu>` com trigger `MoreVertical` (visível em `group-hover` para não poluir)
  - Estado em `KanbanPage`: `editingStage: Stage | null`
  - `handleDelete(stage)`: se `leads.filter(l => l.stage_id === stage.id).length > 0` → toast de erro pedindo pra mover; senão `confirm()` + `delete().eq("id", stage.id)`
  - Realtime já cobre — UI atualiza sozinha via `useStages`

### Arquivos

- **Novo:** `src/components/kanban/EditStageDialog.tsx`
- **Editar:** `src/pages/Kanban.tsx` — imports, menu na coluna, handlers, render do dialog

Aprove para aplicar.
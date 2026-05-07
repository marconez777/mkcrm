## Adicionar gerenciador de etapas no modal "Editar funil"

Adicionar uma seção no `EditPipelineDialog` (ou via Tabs) com gerenciamento completo de etapas: adicionar, renomear, reordenar (drag-and-drop vertical), trocar cor e remover (apenas vazias).

### Arquivos

1. **Novo: `src/components/kanban/StagesManager.tsx`**
   - Lista as etapas do funil ordenadas por `position`.
   - Carrega `pipeline_stages` (id, name, color, position) + contagem de leads por etapa (uma query em `leads` filtrando `stage_id IN (...)`).
   - Drag-and-drop vertical com `@dnd-kit/core` + `@dnd-kit/sortable` (já instalados).
   - Cada linha:
     - Handle `GripVertical` para arrastar.
     - Bolinha de cor → `Popover` com paleta de 12 cores predefinidas.
     - `Input` inline para o nome (salva no blur/Enter).
     - Badge com contagem de leads.
     - Botão lixeira (desabilitado se `lead_count > 0`, com tooltip).
   - Rodapé com `Input` + botão "Adicionar" para criar nova etapa (`position = stages.length`, cor inicial rotaciona da paleta).
   - Reordenação: ao soltar, atualiza `position` das etapas afetadas em paralelo no Supabase.
   - Remoção: `useConfirm` + delete.

2. **Editar `src/components/kanban/EditPipelineDialog.tsx`**
   - Aumentar largura do dialog para `max-w-2xl`.
   - Envolver conteúdo em `Tabs` (shadcn) com duas abas: **"Geral"** (campos atuais: Nome, Tipo, WhatsApp, Mover leads) e **"Etapas"** (renderiza `<StagesManager pipelineId={pipeline.id} />`).
   - Manter o footer Salvar/Cancelar como está (mudanças em etapas são salvas inline, não dependem do botão Salvar).

### Notas
- `@dnd-kit` já está nas dependências.
- Nada de SQL novo, só CRUD em `pipeline_stages` (RLS já permite via `clinic_scoped`).
- Não exclui etapas com leads — usuário precisa mover antes (mensagem clara).
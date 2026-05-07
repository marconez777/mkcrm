## Melhorias no Kanban

### 1) Traço da cor da coluna abaixo do título
Em `src/pages/Kanban.tsx` (componente `Column`), adicionar uma barra horizontal de 3px logo abaixo do header da coluna, usando `stage.color`. Fica entre o `<div>` do título e o corpo da coluna (linha ~234), tanto visual quanto sutil:
```
<div className="mb-2 h-[3px] w-full rounded-full" style={{ background: stage.color || "hsl(var(--muted-foreground))" }} />
```
Aplicar também na versão colapsada (uma faixa vertical fina), mantendo o ponto colorido já existente.

### 2) Botão "Editar funil" no header
Em `src/pages/Kanban.tsx` (header, ~linha 395), adicionar um botão `Editar funil` (ícone `Pencil`) à esquerda dos atalhos existentes, que dispara abertura do `EditPipelineDialog` para o `current` pipeline. Para isso:
- Adicionar estado `editPipelineOpen` em `KanbanPage`.
- Importar `EditPipelineDialog` e renderizá-lo no final, recebendo `pipeline={current}`, `pipelines`, `whatsappInstances`, `onChanged` (recarrega via hooks já reativos).
- Botão desabilitado se `!current`.

### 3) Remover scrollbar superior + destacar a inferior
- Remover o uso de `<TopScrollbar ... />` em `src/pages/Kanban.tsx` (linha 418) e o import (linha 48). Manter o arquivo do componente para não quebrar referências (ou removê-lo já que não é mais usado).
- Em `src/index.css` (.kanban-scroll):
  - Aumentar a altura para 14px em estado normal e 18px em hover.
  - Thumb mais escuro (ex.: `hsl(var(--muted-foreground) / 0.55)`), com `:hover` mais opaco e `:active` na cor `--primary`.
  - Adicionar transição suave `transition: background-color .15s, height .15s`.
  - Para Firefox: `scrollbar-width: auto; scrollbar-color: hsl(var(--muted-foreground) / .55) transparent;` no `.kanban-scroll`.

### 4) Cabeçalho da coluna mais destacado
Em `Column` (Kanban.tsx, ~linha 200-234):
- Aumentar gap/padding do header (`mb-3`, `px-2 py-1.5`).
- Título: `text-base font-bold` (era `text-sm font-semibold`); `text-xs` para o contador → `text-sm font-medium text-muted-foreground`.
- Bolinha colorida: `h-3 w-3` (era `h-2 w-2`) e adicionar leve sombra ou ring.
- Ícones do menu (`MoreVertical`, `Minimize2`): aumentar para `h-4 w-4` e botão para `p-1.5`.
- Manter largura da coluna (`w-80`) para não quebrar layout, ou opcional: `w-[340px]`.

### Arquivos a editar
- `src/pages/Kanban.tsx` — itens 1, 2, 4 + remoção do `TopScrollbar`.
- `src/index.css` — item 3 (estilos `.kanban-scroll`).
- (Opcional) excluir `src/components/kanban/TopScrollbar.tsx`.

Sem mudanças de banco de dados ou de tipos.

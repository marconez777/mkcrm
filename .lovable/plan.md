## Problema

Antes o board do pipeline tinha:
- Barra de rolagem horizontal **embaixo**
- Barra de rolagem horizontal **em cima** (espelhada)
- **Setas** ‹ › nas laterais
- **Arrastar** o fundo vazio para deslizar lateralmente

Hoje só sobrou a barra de baixo. As setas só aparecem quando há overflow real, e a barra de cima foi substituída pelo "PipelineOverview" (mini‑mapa), o que confundiu a navegação.

## O que vamos fazer

1. **Adicionar uma barra de rolagem horizontal superior**, sincronizada com a inferior. Quando o usuário rolar uma, a outra acompanha. Implementada como uma faixa fina logo abaixo do `PipelineOverview`, com a mesma largura do conteúdo do board.

2. **Garantir que as setas ‹ › apareçam sempre que houver overflow** (já existe, mas vamos aumentar a área de clique e dar `z-index` maior pra ficarem por cima do mini‑mapa e do header).

3. **Reforçar o arrastar‑para‑rolar** (`grab/grabbing`) no fundo vazio do board — o hook `useHorizontalScroll` já faz isso, mas o cursor `grab` precisa ficar visível e não conflitar com o dnd-kit dos cards (já tem guarda via `data-kanban-card`, mantemos).

4. **Manter o atalho de teclado** (← → Home End) e a rolagem por wheel (já existem).

### Layout final do topo do board

```text
[ Header com switcher de funil + botões ]
[ PipelineOverview (mini-mapa clicável + barra de progresso) ]
[ ▬▬▬ Barra de rolagem superior (sincronizada) ▬▬▬ ]
[ ‹  Colunas do Kanban (arrastável, scroll horizontal)  › ]
[ ▬▬▬ Barra de rolagem inferior (nativa) ▬▬▬ ]
```

## Detalhes técnicos

- Criar `TopScrollbar.tsx` que recebe `scrollRef` (o container real) e renderiza um `div` com `overflow-x:auto` + um filho com `width = contentW`. Listeners bidirecionais com flag pra evitar loop:
  ```ts
  topEl.onscroll = () => { if (!syncing) { syncing=true; mainEl.scrollLeft = topEl.scrollLeft; syncing=false; } }
  mainEl.onscroll = () => { if (!syncing) { syncing=true; topEl.scrollLeft = mainEl.scrollLeft; syncing=false; } }
  ```
- Expor `contentW` e `viewportW` do `useHorizontalScroll` (já expostos) para dimensionar a barra superior.
- Setas: subir `z-index` para `z-20`, padding maior, sempre visíveis enquanto `overflow.left/right` for true.
- Atualizar `Kanban.tsx` para inserir `<TopScrollbar />` entre `PipelineOverview` e o `<div ref={scrollRef}>`.

## Arquivos

- **Novo:** `src/components/kanban/TopScrollbar.tsx`
- **Editar:** `src/pages/Kanban.tsx` — inserir TopScrollbar e ajustar z-index das setas
- **Editar:** `src/index.css` — estilizar `.kanban-top-scroll` com a mesma estética da barra inferior

Aprove para aplicar.
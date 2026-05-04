## Problema

O arrastar horizontal do board (pan com o mouse no fundo) parou de funcionar de novo. Causa raiz:

1. O `DndContext` agora envolve **toda** a área rolável (`scrollRef`) — antes estava no nível de cada coluna. O `PointerSensor` do dnd-kit captura `pointerdown` em qualquer lugar do board, incluindo o fundo vazio entre colunas e dentro do corpo da coluna (que é um `useDroppable`).
2. Mesmo com `activationConstraint: { distance: 6 }`, o dnd-kit chama `setPointerCapture` e `preventDefault` em `pointermove`, então o `onPointerMove` global do `useHorizontalScroll` recebe os eventos mas o `pointerdown` original nunca foi registrado como pan (porque o hook só registra pan se o target **não** for card/botão — e isso está OK — mas o capture do dnd-kit interfere durante o move).
3. Resultado: clicar no fundo e arrastar não move o pipeline; só funciona em cima de cards (que viram drag de card).

## Solução

Tornar o pan do pipeline robusto independentemente do `DndContext`:

### 1. Em `src/hooks/useHorizontalScroll.ts`
- No `onPointerDown`, quando reconhecer área de pan (target não é card/botão/input), chamar `el.setPointerCapture(e.pointerId)` e `e.preventDefault()` para garantir prioridade sobre o dnd-kit.
- Guardar o `pointerId` no `dragState` e usar `el.releasePointerCapture` no `onPointerUp`.
- Trocar listeners `pointermove`/`pointerup` de `window` para o próprio `el` (com pointer capture eles continuam chegando lá), evitando race com handlers globais.
- Adicionar threshold mínimo de 4px antes de iniciar o pan visual, para não atrapalhar cliques.

### 2. Em `src/pages/Kanban.tsx`
- Adicionar atributo `data-kanban-board-bg` no wrapper interno (`<div className="flex h-full gap-3">`) e nos espaços vazios das colunas, para o hook reconhecer com clareza onde o pan é permitido.
- Manter `cursor: grab` no container e mudar para `grabbing` durante o pan (já existe via classe `kanban-grabbing`).

### 3. Garantia visual
- Confirmar que o cursor `grab` aparece sobre áreas vazias entre colunas e que o pan funciona tanto no fundo quanto sobre a borda interna das colunas vazias.

## Arquivos afetados

- `src/hooks/useHorizontalScroll.ts` — pointer capture + listeners no elemento + threshold.
- `src/pages/Kanban.tsx` — pequenos atributos `data-*` para clareza (opcional, principal fix está no hook).

## Por que não vai quebrar de novo

O pointer capture garante que, uma vez iniciado o pan, todos os `pointermove`/`pointerup` vão para o container de scroll, ignorando o `DndContext`. E o `PointerSensor` do dnd-kit só ativa drag a partir de 6px **vindo de um item sortable** (LeadCard) — fundo do board nunca é sortable, então não há conflito real; o problema atual é só o capture/preventDefault que o nosso handler precisa fazer primeiro.

## Objetivo

Tornar fácil visualizar e navegar por todas as colunas do pipeline mesmo quando há muitas (10+ etapas), aplicando padrões usados por Trello, Linear, Pipedrive e discutidos por devs em r/reactjs, r/UXDesign, blogs Atlassian e Smashing Magazine.

## Pesquisa — o que devs/produtos usam hoje

1. **Trello / Pipedrive**: barra de scroll horizontal "fina" + arrastar com botão do meio / espaço pressionado + clique e arraste no fundo (drag-to-pan).
2. **Linear / Height**: atalhos de teclado `←/→` para pular entre colunas e `Home/End` para extremos.
3. **Notion / Monday**: **mini-mapa** (board overview) no topo mostrando todas as colunas em miniatura — clica e o board centra naquela coluna.
4. **Asana**: botões "<" ">" laterais flutuantes que aparecem só quando há overflow.
5. **Jira**: modo "compactar colunas" — clica no header para colapsar a coluna em uma faixa vertical fina (mostra só nome + contagem).
6. **Shopify Polaris / Atlassian Design**: `scroll-snap-type: x proximity` para travar suavemente em cada coluna ao parar o scroll.
7. **Reddit r/reactjs (threads sobre kanban)**: queixas comuns são (a) shift+scroll não óbvio, (b) trackpad horizontal funciona mas mouse não, (c) auto-scroll durante drag-and-drop é fraco. Soluções recomendadas: wheel listener convertendo `deltaY → scrollLeft`, dnd-kit `AutoScrollOptions` com threshold maior, e indicadores de "tem mais à direita".

## O que vou implementar

### 1. Drag-to-pan no fundo do board
Clicar e arrastar em qualquer área vazia do board (não em cards) faz o board panar horizontalmente — padrão Figma/Miro. Cursor vira `grab/grabbing`.

### 2. Wheel horizontal "natural" para mouse
Listener no container: se `e.deltaY` e não houver `shift`, converte para `scrollLeft`. Permite scroll horizontal com mouse comum sem segurar Shift.

### 3. Setas flutuantes "<" ">" com fade
Aparecem só quando há overflow nessa direção. Clique pula uma "página" (~80% da largura visível). Ficam ocultas no mobile/touch.

### 4. Mini-mapa / Overview bar
Faixa fina abaixo do header mostrando todas as colunas em miniatura (nome + contagem + cor). A janela visível atual é destacada com um retângulo. Clica numa miniatura → board faz `scrollIntoView({ behavior: "smooth", inline: "start" })` daquela coluna. Atualiza ao scrollar (IntersectionObserver nas colunas).

### 5. Colapsar coluna
Botão no header de cada coluna alterna entre `w-72` e `w-10` (modo "spine" vertical com nome rotacionado + contagem). Estado salvo em `localStorage` por usuário. Permite "esconder" colunas pouco usadas e ver muitas de uma vez.

### 6. Atalhos de teclado
- `←` / `→` : scroll uma coluna
- `Home` / `End` : primeira / última coluna
- `Shift+←/→` : mover lead selecionado entre etapas (futuro, fora do escopo agora — só navegação)

### 7. Densidade + scroll snap
- `scroll-snap-type: x proximity` no container, `scroll-snap-align: start` em cada coluna → ao parar de scrollar, a coluna mais próxima "encaixa" na borda.
- Toggle "Compacto" no header: reduz cards (esconde preview da última mensagem, padding menor) — mostra ~40% mais conteúdo vertical.

### 8. Auto-scroll durante drag melhorado
Configurar `DndContext` com `autoScroll={{ threshold: { x: 0.2, y: 0.15 }, acceleration: 20 }}` para o board panar suavemente quando arrasta um card perto da borda.

### 9. Scrollbar horizontal sempre visível e estilizada
Trocar `scrollbar-thin` por uma scrollbar customizada mais grossa (8px), sempre visível (não some), com thumb proeminente — sinal claro de que há mais conteúdo.

## Detalhes técnicos

**Arquivos a editar/criar:**
- `src/pages/Kanban.tsx` — integrar overview, controles, atalhos, drag-to-pan, wheel handler, autoScroll do dnd-kit.
- `src/components/kanban/PipelineOverview.tsx` (novo) — mini-mapa com viewport indicator.
- `src/components/kanban/Column.tsx` (extrair de Kanban.tsx) — suportar estado `collapsed`, `compact`.
- `src/hooks/useHorizontalScroll.ts` (novo) — encapsula wheel-to-horizontal, drag-to-pan, refs e estado de overflow para setas.
- `src/index.css` — classe `.kanban-scroll` com snap + scrollbar customizada.

**Persistência leve:** colunas colapsadas e modo compacto em `localStorage` (`pipeline:ui:v1`).

**Sem mudanças de backend.** Nenhuma migration necessária.

## Fora de escopo (posso fazer depois se quiser)
- Reordenar colunas via drag.
- Filtros salvos / múltiplos pipelines.
- Virtualização vertical de cards (só vale a pena com 500+ leads por coluna).

Aprove para eu aplicar.

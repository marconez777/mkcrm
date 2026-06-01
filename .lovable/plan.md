# Performance do Kanban com muitos leads

## Causa raiz

Com ~2400 leads em um pipeline, o Kanban renderiza **todos os cards de todas as colunas ao mesmo tempo**. Cada card é um nó com `useSortable` (dnd-kit) + `DropdownMenu` (radix) + handlers. Isso trava a rolagem horizontal/vertical e a digitação na busca, porque qualquer state change re-renderiza milhares de cards.

## Soluções (por ordem de impacto)

### 1. Virtualizar a lista vertical de cada coluna (maior ganho)

Instalar `@tanstack/react-virtual` (~3KB, padrão no ecossistema).

Em `Column` (`src/pages/Kanban.tsx`), trocar o `map` direto de leads por um `useVirtualizer` ancorado no `div` rolável (`data-kanban-column-body`). Render apenas dos cards visíveis + um overscan de ~6 itens.

Resultado: uma coluna com 500 leads passa a ter ~15 nós no DOM em vez de 500. O dnd-kit continua funcionando porque os IDs do `SortableContext` continuam sendo a lista completa; só os elementos renderizados é que reduzem.

Detalhe técnico: usar `estimateSize` dinâmico baseado no modo `compact` (~58px vs ~108px), e `measureElement` para corrigir alturas reais.

### 2. Memoizar `LeadCard` e estabilizar props

- Envolver `LeadCard` em `React.memo` com comparador que checa só os campos visíveis (`name`, `phone`, `last_message_at`, `last_message_preview`, `unread_count`, `pinned_at`, `stage_id`, `position`, `created_at`, `deal_value` + `compact`).
- Em `KanbanPage`, criar `onOpenLead`, `onMoveLead`, `onMoveLeadToStage` via `useCallback` para não invalidar o memo.
- Passar `allStages` (do `Mover para coluna`) como referência estável via `useMemo`.

### 3. Pré-agrupar leads por `stage_id` uma única vez

Hoje cada `<Column>` faz `leads.filter(l => l.stage_id === s.id).slice().sort(...)` dentro do JSX — N×M por render.

Trocar por um `useMemo` em `KanbanPage` que produz `Map<stage_id, Lead[]>` já ordenado (pinned desc + last_message_at desc). A `Column` passa a receber o array pronto.

### 4. Aliviar o `DropdownMenu` do card

- Não mudar a UX, só evitar re-render: o `otherStages` é recomputado por card a cada render. Mover esse cálculo para um `useMemo` no `KanbanPage` (um `Map<excludeStageId, Stage[]>` ou simplesmente passar `allStages` e calcular dentro do submenu só quando aberto).

### 5. CSS hints para o navegador

Na coluna rolável (`data-kanban-column-body`) e no container horizontal (`.kanban-scroll`), adicionar:

```css
contain: layout paint style;
content-visibility: auto;
```

E em `LeadCard`: `contain: layout paint`.

Isso permite ao Chrome pular layout/paint de cards fora da viewport, mesmo sem virtualização — efeito complementar.

## Fora de escopo

- Não vou tocar na lógica de drag-and-drop, ordenação, ou no shape dos dados.
- Não vou paginar a coluna no backend (já carregamos tudo em paged-fetch; o problema é DOM, não rede).
- Não vou trocar dnd-kit por outra lib.

## Verificação

- Abrir o pipeline "Agendamentos Novo" e rolar verticalmente uma coluna grande (deve ficar fluida a 60fps).
- Rolar horizontalmente entre as colunas (sem travadas).
- Digitar na busca (sem lag entre teclas).
- Arrastar um card para outra coluna (drag continua funcional).
- Verificar Console: nenhum erro de chave duplicada ou warning do dnd-kit.

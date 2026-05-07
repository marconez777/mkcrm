## Objetivo
Deixar a rolagem horizontal do Kanban tão fluida quanto a do Kommo — sem "trancos" no scroll com a roda do mouse e com inércia suave ao soltar o arrasto.

## Diagnóstico
Hoje em `src/hooks/useHorizontalScroll.ts`:

- **Wheel handler** faz `el.scrollLeft += e.deltaY` direto a cada evento. Isso briga com o `scroll-behavior: smooth` (definido em `.kanban-scroll` no `index.css`) e com o trackpad/mouse de alta frequência, gerando saltos.
- **Arrasto (pointer drag)** desativa `scroll-behavior` e ao soltar o ponteiro o board para imediatamente — sem inércia. Kommo aplica momentum (continua deslizando e desacelera).
- Não há acumulação/normalização de delta — uma roda "notched" entrega 100px de uma vez, gerando pulo visível.

## Mudanças

### 1) `src/hooks/useHorizontalScroll.ts` — rolagem com requestAnimationFrame
- Substituir `el.scrollLeft += e.deltaY` por um **alvo acumulado + loop rAF** que interpola (`current += (target - current) * 0.22`) até estabilizar. Isso suaviza tanto trackpad como mouse com roda discreta.
- Normalizar `deltaMode` (linha vs pixel): multiplicar por ~16 quando `deltaMode === 1`.
- Garantir `scroll-behavior: auto` durante esse loop (o smooth do CSS conflita com rAF).
- **Inércia ao soltar arrasto**: medir velocidade nos últimos ~80ms do `pointermove` (px/ms) e, no `pointerup`, iniciar um loop rAF que aplica `velocity *= 0.94` por frame até `|v| < 0.05`. Cancelar inércia se houver novo `pointerdown` ou wheel.
- Cancelar o rAF no cleanup do `useEffect`.

### 2) `src/index.css` — remover conflito de smooth-scroll
- Em `.kanban-scroll`, trocar `scroll-behavior: smooth` por `scroll-behavior: auto`. A suavidade passa a vir do JS (rAF), evitando que o navegador "queime" deltas pequenos.
- Manter visual da scrollbar inferior intocado.
- Manter `scroll-snap-type: x proximity` (não atrapalha o rAF e ajuda o alinhamento final, igual Kommo).

### 3) Sem mudanças em
- `Kanban.tsx`, `EditPipelineDialog`, banco de dados, tipos. A API do hook (`ref`, `overflow`, `scrollByPage`, `scrollToEnd`, `scrollToColumn`, `scrollX`, `viewportW`, `contentW`) permanece a mesma.

## Detalhes técnicos
- O loop rAF usa um único `rafId` compartilhado entre wheel e inércia, com estado `{ target, current, velocity, mode: 'wheel'|'inertia'|null }` em `useRef`.
- Clamp do `target` em `[0, scrollWidth - clientWidth]` para evitar overshoot.
- `scrollByPage` e `scrollToEnd` continuam usando `el.scrollTo({ behavior: 'smooth' })` — esses são eventos pontuais (botão), onde o smooth nativo funciona bem.
- Preservar a guarda atual: se o cursor estiver sobre uma coluna com scroll vertical próprio (`[data-kanban-column-body]`) e `deltaY` predominar, não sequestrar o evento.

## Resultado esperado
- Roda do mouse e trackpad deslizam continuamente, sem trancos.
- Ao arrastar e soltar, o board continua deslizando com desaceleração natural (estilo Kommo).
- Botões de paginação (`scrollByPage`) seguem com animação smooth nativa.

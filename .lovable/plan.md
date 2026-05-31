# Plano: Aliviar animações scroll-based

## Diagnóstico

Hoje o site tem 7 seções animadas (Features, Services, Integrations, Testimonials, Pricing, Blog, About) com o mesmo padrão pesado. Os principais gargalos:

1. **Springs em excesso** — cada card faz 5 `useSpring` (opacity, y, scale, rotateX, active) + 2–3 transforms derivados. Em Services (6 cards) são 30+ springs animando em cada frame do scroll. Springs forçam re-cálculo a cada rAF mesmo quando o scroll para.
2. **Listeners de scroll redundantes** — cada seção monta seu próprio `useScroll`, totalizando 7 observers de scroll simultâneos com cálculo independente de `scrollYProgress`.
3. **Auroras pesadas** — 4 `AuroraBlob` por seção × 7 seções = até 28 elementos com `blur-3xl` (filtro GPU caríssimo) animando `opacity/scale/x/y` continuamente em loop infinito, mesmo quando a seção está fora da viewport.
4. **rotateX + perspective** — força camada 3D extra na composição.
5. **Active highlight curve** — adiciona spring + box-shadow animado por card (box-shadow não é GPU-acelerado e dispara repaint).
6. **Auroras animam offscreen** — `repeat: Infinity` mantém o rAF rodando mesmo quando a seção não está visível.

## Estratégia

Manter a sensação premium, mas cortar o custo:

### A. Substituir scroll-based contínuo por entry-once em todas as seções **exceto Services**
- Trocar `useScroll` + `useTransform` + `useSpring` por **`whileInView`** (`viewport={{ once: true, margin: "-10% 0px" }}`) com `transition` tween curta. Isso elimina o cálculo por frame: a animação roda uma vez na entrada e para. Visualmente quase idêntico ao efeito de entrada atual.
- Remover springs encadeados; usar `initial`/`animate` simples com `ease: [0.22, 1, 0.36, 1]` e `duration: 0.6–0.8`.
- Manter cascata (delay por índice de card: `0.06 * i`).
- Remover `rotateX` e `scale` da entrada padrão (manter só `opacity` + `y`). O ganho de fluidez é grande e o efeito final continua premium.

### B. Services mantém scroll-based, mas otimizado
Services é a "vitrine" mais elaborada — vale preservar o efeito, mas:
- Reduzir springs por card de 5 → 2 (apenas `opacity` e `y` com spring; `scale`/`rotateX` viram tween simples ou são removidos).
- Remover o "active highlight" baseado em `scrollYProgress` (box-shadow + scale boost por card). Substituir por **hover-only** glow (já existe efeito de hover; basta intensificar). Ganho enorme: elimina 6 springs + 6 box-shadow animados.
- Manter cabeçalho em cascata via `whileInView` (não precisa de scroll contínuo).

### C. Auroras — drasticamente mais leves
- Reduzir de 4 → **2** AuroraBlob por seção.
- Trocar `blur-3xl` (radius ~64px) por `blur-2xl` (40px) — diferença visual mínima, custo de filtro bem menor.
- Remover parallax `y` baseado em `scrollYProgress` (elimina mais um listener por blob).
- Animar apenas `opacity` no loop (já é o caso no mobile); remover `x`/`scale`/`y`. Loop continua dando vida sem mover camadas.
- Pausar animação quando offscreen: envolver com `whileInView` + `viewport={{ once: false }}` e usar `animate` controlado por estado de inView, OU usar `IntersectionObserver` simples para montar/desmontar.
- Em mobile/`prefers-reduced-motion`: auroras 100% estáticas (sem loop).

### D. _anim.tsx — utilitários atualizados
- Adicionar helpers `fadeUp` (variants) e `cascade(i)` para reuso.
- `AuroraBlob` refatorado: sem `parallaxY`, sem props `animate` complexas; só `duration`, `reduce`, `isMobile` e classe de posição.

### E. Hints de performance
- Adicionar `content-visibility: auto` + `contain-intrinsic-size` nas seções abaixo do fold (corte de layout/paint offscreen).
- Confirmar `will-change` apenas em elementos realmente animados (remover dos containers estáticos).
- Garantir que `<section>` raiz não tenha `overflow-hidden` desnecessário que crie stacking context extra.

## Arquivos a editar

- `src/components/site/_anim.tsx` — refatorar `AuroraBlob`, exportar `fadeUp` variants e helper `cascade`.
- `src/components/site/Features.tsx` — migrar para `whileInView` + variants; reduzir auroras.
- `src/components/site/Services.tsx` — manter scroll-based no cabeçalho/cards mas cortar springs (5→2 por card), remover active-highlight scroll-based (vira hover), reduzir auroras.
- `src/components/site/Integrations.tsx` — migrar para `whileInView`; reduzir auroras.
- `src/components/site/Testimonials.tsx` — idem.
- `src/components/site/Pricing.tsx` — idem; manter destaque permanente do plano Pro como estilo estático (sem spring).
- `src/components/site/Blog.tsx` — idem.

## Garantias

- **Zero mudança de copy, layout, cores, espaçamento, hierarquia, cards, navbar.**
- Mesma sensação de entrada (fade + translateY + cascata + glow nas palavras-chave em verde — esse glow vira CSS estático ou tween curta).
- `prefers-reduced-motion` continua respeitado.
- Mobile: simplificado igual hoje (sem rotateX, sem parallax).

## Ganho esperado

- Scroll listeners: 7 → 1 (apenas Services).
- Springs simultâneos: ~80 → ~12.
- Elementos com `blur-3xl` animados: ~28 → ~14 com `blur-2xl`, pausados offscreen.
- rAF ativo durante scroll idle: praticamente zero.

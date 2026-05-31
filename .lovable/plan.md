## Arquivo afetado

`src/components/site/Services.tsx` — único arquivo. Sem mudança de copy, layout, classes de cor, hierarquia ou estrutura DOM (apenas wrappers `motion.*`, overlays absolutos e blobs adicionais).

## Abordagem

Framer Motion (já instalado): `useScroll` + `useTransform` + `useSpring` ancorado a um `ref` na `<section>`. Sem listeners manuais, sem hijacking.

### 1. Fundo animado (auroras roxas)
- Manter os 2 blobs existentes; transformar em `motion.div` com animação contínua (loop infinito) muito lenta:
  - Blob A (esquerdo): `x` ±30px, `y` ±20px, `scale` 1 ↔ 1.08 em 18s `ease: "easeInOut"` `repeat: Infinity` `repeatType: "mirror"`.
  - Blob B (direito): `x` ±25px, `y` ±30px, `scale` 1 ↔ 1.06 em 22s (defasado).
- Adicionar **2 blobs extras** atrás do conteúdo (z behind), bem grandes e suaves:
  - Camada C (centro-topo): violeta `hsl(var(--site-accent-glow) / 0.22)`, 720px, blur-3xl, anima 26s.
  - Camada D (centro-baixo): roxo escuro com toque pink `hsl(285 80% 35% / 0.18)`, 640px, blur-3xl, anima 30s.
- Acoplamento ao scroll **sutil**: cada blob também recebe um `y` derivado de `scrollYProgress` (deslocamento total ~40px ao longo da seção) via `useTransform` + `useSpring` (parallax leve). O loop contínuo é multiplicado pelo offset do scroll — implementado aplicando `style` de transform no wrapper e `animate` no filho, ou simplesmente somando via `motionValues` no `style` (Framer Motion suporta passar arrays/funções). Solução prática: wrapper `motion.div` com `style={{ y: parallaxY }}` e dentro um `motion.div` com `animate={{ x: [...], y: [...], scale: [...] }}`.
- Tudo em `aria-hidden`, `pointer-events-none`, atrás do conteúdo (sem alterar z-index do conteúdo).
- `prefers-reduced-motion`: blobs ficam estáticos (sem `animate`), só com a cor de fundo.
- Mobile: simplificar para 2 blobs (originais), animação reduzida (apenas opacity breathing 0.5↔0.7 em 12s, sem deslocamento), sem parallax de scroll.

### 2. Cabeçalho (entrada sequencial)
- Badge "O que entregamos": `opacity` 0→1 + `y` 12→0 em `[0.05, 0.22]`.
- Título "Serviços que fazem o funil girar": `opacity` 0→1 + `y` 28→0 em `[0.1, 0.3]`.
- Glow verde nas palavras "funil" e "girar": envolver cada uma em `motion.span` (mantendo `text-site-primary`), com `text-shadow` animado `0 0 0` → `0 0 22px hsl(var(--site-primary) / 0.5)` em `[0.12, 0.3]`, suavizando para residual `0 0 8px / 0.18` em `[0.3, 0.45]`. Como o markup atual é `funil girar` numa só `<span>`, vou abrir em duas `motion.span` mantendo o espaço literal entre elas — sem mudar copy.
- Parágrafo direito: `opacity` 0→1 + `y` 16→0 em `[0.18, 0.38]`.
- Springs uniformes (`stiffness: 80, damping: 22, mass: 0.5`).

### 3. Cards (cascata por linha, 6 cards)
- Cada `<li>` vira `motion.li`. Faixas pensadas em cascata por linha (3 + 3 em desktop):
  - Card 01: `[0.22, 0.42]`
  - Card 02: `[0.26, 0.46]`
  - Card 03: `[0.30, 0.50]`
  - Card 04: `[0.36, 0.56]`
  - Card 05: `[0.40, 0.60]`
  - Card 06: `[0.44, 0.64]`
- Transforms de entrada: `opacity` 0→1, `y` 50→0, `scale` 0.96→1, `rotateX` 4deg→0deg.
- A `<ol>` recebe `style={{ perspective: 1200 }}` para o `rotateX` ter profundidade.
- Em mobile: só `opacity` + `y` curto (20px), sem `rotateX`/`scale`.

### 4. Destaque do card ativo (segue o scroll)
- Cada card tem uma curva de "presença" no centro da viewport. Para evitar custo de `getBoundingClientRect` em handler, uso o próprio `scrollYProgress` da seção: defino um ponto-pico por card distribuído pelo progresso (ex.: pico em `0.3, 0.36, 0.42, 0.5, 0.56, 0.62`) e aplico uma curva triangular:
  - `useTransform(progress, [peak-0.06, peak, peak+0.06], [0, 1, 0])` → valor de "active".
  - Aplicado como:
    - `boxShadow`: `inset 0 0 0 1px hsl(var(--site-primary) / 0.35*a), 0 24px 60px -24px hsl(var(--site-accent) / 0.35*a)`.
    - `scale` boost: combinado com o scale de entrada via curva única `[entryStart, peak, entryEnd] → [0.96, 1.012, 1]`.
  - Overlay gradiente discreto (verde→roxo) com `opacity: active * 0.6`.
- Curva suave (springs) garante transição entre cards sem salto.
- Mobile/reduce: destaque com intensidade reduzida (0.4× / 0.25×).

### 5. Acessibilidade e mobile
- `useReducedMotion()`: tudo renderiza em estado final, sem glow, sem parallax, blobs estáticos.
- `matchMedia("(max-width: 768px)")` via hook local `useIsMobile` (mesmo padrão de `About.tsx`/`Features.tsx`).
- No mobile: sem `rotateX`, sem `scale` de entrada, parallax do fundo desligado, animação dos blobs minimizada.

### 6. Garantias técnicas
- Só `transform`, `opacity`, `box-shadow` e `text-shadow` — nenhum reflow.
- Sem hijacking, sem `wheel`/`scroll` listeners manuais.
- `willChange: "transform, opacity"` nos elementos animados.
- Copy, classes de cor, estrutura DOM e layout preservados (apenas wrappers `motion.*` e blobs/overlays adicionados).

## Estrutura de código
- Subcomponente `ServiceCard` no mesmo arquivo, recebendo `range`, `peak`, `progress`, `reduce`, `isMobile`, e os campos do serviço.
- Hook `useIsMobile` local (duplicar para manter mudanças escopadas a este arquivo, mesmo padrão das outras seções animadas).

## Validação
- Preview a 1138px: badge → título com glow nos verdes → parágrafo → 6 cards em cascata 3+3 → destaque migra suavemente conforme scroll → fundo com 4 auroras roxas respirando.
- Reduzir viewport para <768px: versão simplificada (sem 3D, sem parallax, blobs estáticos com breathing leve).
- `prefers-reduced-motion`: tudo estático, sem glow, blobs sem animação.

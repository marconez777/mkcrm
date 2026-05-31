## Arquivo afetado

`src/components/site/About.tsx` — único arquivo. Sem mudança em layout, copy, cores ou estrutura DOM (apenas wrappers `motion.*`).

## Abordagem

Framer Motion (já instalado) com `useScroll` + `useTransform` + `useSpring` ancorado a um `ref` da seção. Sem IntersectionObserver, sem listeners de scroll manuais, sem hijacking.

### 1. Título à esquerda
- `motion.div` envolvendo o bloco do `h2` + badge.
- `opacity` 0 → 1 e `x` -40 → 0 conforme `scrollYProgress` da seção em `[0, 0.25]`.
- Springs suaves (`stiffness: 80, damping: 22`).

### 2. Glow na palavra "relacionamento"
- `motion.span` ao redor da palavra com `text-shadow` animado: `0 0 0 transparent` → `0 0 24px hsl(var(--site-primary) / 0.55)` durante a entrada `[0.05, 0.3]`, depois suaviza de volta para um glow residual mínimo (`0 0 8px / 0.2`) em `[0.3, 0.45]` para não ficar permanentemente chamativo.

### 3. Parágrafo à direita
- `motion.p` com `opacity` 0 → 1 e `y` 24 → 0 em `[0.1, 0.35]`.

### 4. Cards em sequência (1 → 2 → 3)
- Cada `<article>` vira `motion.article`, com sua própria faixa de progresso:
  - Card 1: `[0.2, 0.45]`
  - Card 2: `[0.3, 0.55]`
  - Card 3: `[0.4, 0.65]`
- Transforms por card: `opacity` 0 → 1, `y` 40 → 0, `scale` 0.96 → 1, `rotateX` 4deg → 0deg.
- Wrapper grid recebe `style={{ perspective: 1200 }}` para o `rotateX` ter profundidade real.

### 5. Destaque ativo "passando" pelos cards
- Cada card recebe um `motion.div` interno absoluto (atrás do conteúdo) com:
  - Borda verde extra (`box-shadow: 0 0 0 1px hsl(var(--site-primary) / X)`)
  - Glow verde sutil (`0 20px 60px -20px hsl(var(--site-primary) / X)`)
  - Gradiente discreto roxo→verde (semelhante ao halo existente do card)
- A opacidade desse overlay é uma curva "pico" (`useTransform` com array `[in, peak, out] → [0, 1, 0.25]`) por card, sincronizada com sua faixa — fica brilhante quando entra e suaviza para um destaque residual elegante. Card 1 mantém o destaque residual visível para casar com o estilo atual da hover.

### 6. Acessibilidade e mobile
- `useReducedMotion()`: quando `true`, todos os transforms retornam valor final (opacity 1, sem deslocamento) e o overlay de destaque fica em opacidade residual fixa.
- `matchMedia("(max-width: 768px)")` via `useState` + listener: no mobile, remover `rotateX` e `scale`, manter só `opacity` + `y` curto (16px). Glow do título e overlay dos cards reduzidos para ~40% de intensidade.

### 7. Garantias técnicas
- Só `transform`, `opacity` e `box-shadow`/`text-shadow` (não animam reflow).
- Reversível ao subir (springs reagem ao `scrollYProgress` em ambas direções).
- Sem mudança em copy, classes de cor, layout grid ou hierarquia DOM além de trocar tags por `motion.*` e adicionar overlays absolutos.

## Validação
- Conferir no preview: rolar até a seção e observar entrada sequencial; rolar de volta e ver reversão; reduzir viewport para <768px e checar versão simplificada.

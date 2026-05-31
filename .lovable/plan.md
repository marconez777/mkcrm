## Arquivo afetado

`src/components/site/Features.tsx` — único arquivo. Sem mudança de copy, layout, cores, classes de tipografia ou estrutura DOM (apenas wrappers `motion.*` e overlays absolutos).

## Abordagem

Framer Motion (já instalado): `useScroll` + `useTransform` + `useSpring` ancorado a um `ref` na `<section>`. Sem listeners manuais, sem hijacking.

### 1. Cabeçalho (entrada sequencial)
- Bloco do cabeçalho dentro de `motion.div` para herdar contexto, mas cada elemento anima individualmente via `scrollYProgress` da seção em faixas distintas:
  - Badge "Nossas features": `opacity` 0→1 + `y` 12→0 em `[0.05, 0.22]`.
  - Título "POR QUE MK-CRM": `opacity` 0→1 + `y` 32→0 em `[0.1, 0.3]`.
  - Glow roxo no outline `MK-CRM`: `text-shadow` `0 0 0` → `0 0 28px hsl(var(--site-accent-glow) / 0.55)` em `[0.12, 0.3]`, suavizando para residual `0 0 10px / 0.18` em `[0.3, 0.45]`.
  - Subtítulo: `opacity` 0→1 + `y` 16→0 em `[0.18, 0.38]`.
- Springs uniformes (`stiffness: 80, damping: 22, mass: 0.5`).

### 2. Cards (sequenciais 1→2→3)
- `<article>` vira `motion.article`. Cada um com faixa própria:
  - Pipeline: `[0.28, 0.5]`
  - WhatsApp: `[0.36, 0.58]`
  - IA: `[0.44, 0.66]`
- Transforms de entrada: `opacity` 0→1, `y` 60→0, `scale` 0.96→1, `rotateX` 5deg→0deg.
- Grid recebe `style={{ perspective: 1200 }}` para o `rotateX` ter profundidade real.

### 3. Parallax interno do mockup
- Dentro de cada card, a `<img>` vira `motion.img`:
  - `y`: -8 → 8 (deslocamento sutil de ~16px no total) sobre uma faixa ampla `[entryStart, entryStart + 0.45]`.
  - `scale`: 1 → 1.04 na mesma faixa.
- Preserva `object-cover` e dimensões; o efeito `hover:scale-[1.04]` original é substituído pelo motion (mantém a mesma intensidade).

### 4. Destaque ativo do card
- Overlay `motion.div` absoluto dentro do card (atrás do conteúdo, acima da imagem) com:
  - `box-shadow`: `inset 0 0 0 1px hsl(var(--site-primary) / 0.4 * h)` + `0 24px 60px -24px hsl(var(--site-accent) / 0.35 * h)`.
  - Gradiente discreto verde→roxo.
- `opacity` por curva de pico `[start, peak, end, end+0.05] → [0, 1*k, 0.35*k, 0.25*k]` sincronizado com a faixa do card. `k` = intensidade.
- `scale` do card recebe leve boost no pico: `useTransform` retornando 1 → 1.015 → 1 (somado via `scale` já existente seria conflito; em vez disso, aplicar o boost num wrapper interno ou multiplicar via função). Solução simples: substituir o `scale` de entrada por uma curva combinada `[start, peak, end] → [0.96, 1.015, 1]`.

### 5. Acessibilidade e mobile
- `useReducedMotion()`: quando `true`, todos os elementos renderizam em estado final (`opacity: 1`, sem deslocamentos), sem glow e sem parallax.
- `matchMedia("(max-width: 768px)")`: no mobile, remover `rotateX`, parallax interno e boost de scale; manter apenas `opacity` + `y` curto (20px) nos cards, e fade-in simples no cabeçalho. Glow do título reduzido para ~40%.

### 6. Garantias técnicas
- Só `transform`, `opacity`, `box-shadow` e `text-shadow` — nada de reflow.
- Reversível ao subir (springs reagem nos dois sentidos).
- `willChange: "transform, opacity"` nos elementos animados.
- Copy, classes de cor, layout e estrutura DOM preservados (somente tags trocadas para `motion.*` e overlays absolutos adicionados).

## Estrutura de código
- Extrair um subcomponente `FeatureCard` no mesmo arquivo, recebendo `range`, `progress`, `reduce`, `isMobile` (mesmo padrão usado em `About.tsx`).
- Hook `useIsMobile` local (igual ao já existente em `About.tsx`; aceitável duplicar para manter mudanças escopadas a um arquivo).

## Validação
- Conferir no preview (1138px): cabeçalho entra em cascata, cards aparecem em sequência com destaque e parallax sutil no mockup.
- Reduzir viewport para <768px: versão simplificada sem 3D nem parallax.
- Ativar reduced-motion no SO: tudo aparece estático e completo.

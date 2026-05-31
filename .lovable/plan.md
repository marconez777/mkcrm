
## Objetivo

Adicionar rotação suave ao objeto 3D do Hero (`hero-3d.png`) que reage ao progresso do scroll: gira ao descer, reverte ao subir. Sem afetar layout, textos, botões, navbar ou background.

## Arquivo afetado

- `src/components/site/Hero.tsx` — único arquivo alterado. Apenas o `<img src={hero3d} />` e seu wrapper recebem a animação.

## Abordagem técnica

Usar **Framer Motion** (`motion` + `useScroll` + `useTransform` + `useSpring`) — já é uma dependência comum e performática, sem listeners manuais de scroll.

1. Transformar o `<img>` do hero em `motion.img` (mantendo classes, `src`, `alt`, dimensões).
2. `useScroll()` com `offset: ["start start", "end start"]` ancorado a um `ref` no wrapper da imagem → progresso de 0 a 1 ao longo dos primeiros ~600–900px da Hero.
3. Mapear o progresso com `useTransform`:
   - `rotateY`: 0 → 25deg
   - `rotateZ`: 0 → 8deg
   - `scale`: 1 → 1.03
4. Envolver cada transform em `useSpring({ stiffness: 80, damping: 20, mass: 0.6 })` para inércia/suavidade — evita tremidas e dá sensação flutuante.
5. Aplicar via `style={{ rotateY, rotateZ, scale }}` no `motion.img`. Adicionar `style={{ transformPerspective: 1000, willChange: "transform" }}` para profundidade 3D real e GPU.
6. O halo verde (div blur atrás da imagem) permanece estático — só o objeto gira.

## Acessibilidade e mobile

- `useReducedMotion()` do Framer Motion: se `true`, retornar transforms fixos em 0 (sem animação).
- Mobile (`matchMedia("(max-width: 768px)")` num `useEffect` com state): reduzir intensidade para ~40% (rotateY 0→10deg, rotateZ 0→3deg, sem scale). Detecção uma vez no mount, com listener de resize cancelável.

## Garantias

- Só `transform` e `opacity` (não usados aqui) — nada de `top/left/width/height/margin/padding`.
- Sem scroll hijacking: nenhum `preventDefault`, nenhum listener de wheel.
- Layout, copy, cores e estrutura do Hero preservados — apenas o elemento `<img>` ganha `motion` + `style` de transform.
- Springs garantem reversibilidade automática ao subir o scroll.

## Validação

- Conferir no preview (desktop 1138px e mobile <768px) que a rotação aparece nos primeiros ~700px de scroll, estabiliza depois, e que nada mais muda visualmente.

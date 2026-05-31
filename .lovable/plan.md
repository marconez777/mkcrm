## Escopo

Aplicar o mesmo padrão de animação scroll-based premium nas 4 seções restantes que ainda não receberam o tratamento:

- `Integrations` — cabeçalho + 8 cards em grid 4 col
- `Testimonials` — cabeçalho + 3 cards de depoimento
- `Pricing` — cabeçalho + 3 planos (com destaque persistente do Pro)
- `Blog` — cabeçalho + botão "Ver tudo" + 3 cards de post

`Marquee` (faixa de logos infinita) e `SiteNav`/`SiteFooter` ficam de fora — não fazem parte do padrão "seção reveal + cards".

## Refator leve (anti-duplicação)

Criar um único módulo utilitário compartilhado: **`src/components/site/_anim.tsx`** com:
- Constante `SPRING = { stiffness: 80, damping: 22, mass: 0.5 }`
- Hook `useIsMobile()` (matchMedia 768px)
- Componente `AuroraBlob` (versão genérica reutilizável que aceita props de classe, background, animate, duration, parallaxY opcional, reduce, isMobile)

Os 3 arquivos já animados (`About.tsx`, `Features.tsx`, `Services.tsx`) **permanecem inalterados** — o módulo `_anim.tsx` é só para os novos. Não há risco de regressão. (Opcional/futuro: migrar os antigos pra consumir o módulo; não faço agora pra manter o diff escopado.)

## Padrão de animação aplicado em cada seção

Mesma fórmula validada nas seções anteriores:

### Cabeçalho (entrada sequencial)
- Badge: `opacity` 0→1 + `y` 12→0 em `[0.05, 0.22]`
- Título: `opacity` 0→1 + `y` 28→0 em `[0.1, 0.3]`
- Glow verde sutil nas palavras destacadas em `text-site-primary`: `text-shadow` pulsando para residual em `[0.12, 0.3, 0.45] → [0, 1, 0.32]` (intensidade 0.4× no mobile)
- Subtítulo/parágrafo: `opacity` 0→1 + `y` 16→0 em `[0.18, 0.38]`

### Cards (sequenciais)
Cada card vira `motion.li` (ou `motion.a` em Blog) com faixas escalonadas:
- `opacity` 0→1
- `y` 50→0 (20 mobile)
- `scale` combinado com pico ativo: `[start, peak, end] → [0.96, 1.012, 1]` (1,1,1 mobile)
- `rotateX` 4deg→0deg (0 mobile)
- Destaque ativo no pico: `boxShadow` interno verde + sombra externa roxa, modulado por uma curva triangular `[peak-0.06, peak, peak+0.06] → [0, 1, 0]`
- Overlay gradiente discreto verde→roxo no pico

### Auroras de fundo
Substituir os 2 blobs estáticos atuais de cada seção por `AuroraBlob` animados (loop muito lento, parallax sutil ligado ao scroll). Em desktop, adicionar 1–2 camadas extras para profundidade. No mobile, manter apenas os blobs originais com breathing de opacidade.

## Particularidades por seção

### `Integrations.tsx`
- Glow na palavra "tudo" do título
- 8 cards no grid 2/3/4 colunas — cascata por progresso, faixas estreitas para não demorar demais. Faixas: `[0.22..0.40]` até `[0.42..0.60]`, picos distribuídos por linha.
- Parágrafo final "Não vê a sua ferramenta…" também recebe fade-in tardio em `[0.6, 0.78]`.
- `<ul>` recebe `perspective: 1200`.
- Manter o `hover:-translate-y-1` original — não conflita com o `y` do motion porque o hover é em transform CSS que o Framer Motion sobrescreve via `style`. Solução: remover o `hover:-translate-y-1` e simular com `whileHover={{ y: -4 }}` no `motion.li` para não brigar com o `y` do scroll. (O scroll `y` é uma `MotionValue`; `whileHover` compõe corretamente em Framer Motion v12.)

### `Testimonials.tsx`
- Glow na palavra "MK-CRM" do título
- 3 cards: faixas `[0.22, 0.42]`, `[0.28, 0.48]`, `[0.34, 0.54]`, picos em 0.32, 0.38, 0.44
- Mesmo tratamento de `hover:-translate-y-1` → `whileHover={{ y: -4 }}`
- Pílula `metric` no topo do card mantida como está (não anima separadamente para não poluir)

### `Pricing.tsx`
- Glow na palavra "sem letra miúda"
- 3 planos: faixas `[0.22, 0.44]`, `[0.28, 0.5]`, `[0.34, 0.56]`, picos em 0.33, 0.39, 0.45
- **Plano Pro (highlight)**: mantém a borda permanente, halo roxo persistente, sombra `shadow-[0_30px_80px_-30px_hsl(var(--site-accent)/0.6)]` e a badge "Mais escolhido". A animação de entrada/destaque é **somada** ao destaque permanente do Pro — o glow ativo passa por todos, mas o Pro continua visualmente mais alto sempre. Implementação: a curva de destaque do Pro tem floor maior (residual 0.4 em vez de 0), garantindo que ele sempre brilhe um pouco.
- CTA `<a>` dentro do plano não anima individualmente — herda do card.

### `Blog.tsx`
- Glow na palavra "central de ajuda"
- Botão "Ver tudo" entra junto com o subtítulo (`[0.2, 0.4]`)
- 3 cards (são `<a>` dentro de `<li>`): aplico `motion.a` para o link, ou `motion.li` no wrapper — opto por `motion.li` para preservar o `<a>` interativo intacto. Faixas: `[0.3, 0.5]`, `[0.36, 0.56]`, `[0.42, 0.62]`, picos em 0.4, 0.46, 0.52.
- `hover:-translate-y-1` no `<a>` interno é preservado (não conflita com `y` do `motion.li`).
- Parágrafo "Em breve: central de ajuda…" recebe fade-in tardio em `[0.6, 0.78]`.

## Garantias técnicas

- Só `transform`, `opacity`, `box-shadow`, `text-shadow` — nada de reflow.
- `prefers-reduced-motion`: tudo em estado final, sem glow, blobs estáticos.
- Mobile (<768px): sem `rotateX`, sem `scale`, parallax desligado, blobs reduzidos a breathing de opacity.
- `willChange: "transform, opacity"` nos elementos animados.
- Copy, classes de cor, layout grid e estrutura DOM 100% preservados — apenas tags trocadas para `motion.*`, blobs trocados por `AuroraBlob`, e overlays absolutos adicionais.

## Arquivos

- **Criar**: `src/components/site/_anim.tsx` (utils compartilhados)
- **Editar**: `src/components/site/Integrations.tsx`
- **Editar**: `src/components/site/Testimonials.tsx`
- **Editar**: `src/components/site/Pricing.tsx`
- **Editar**: `src/components/site/Blog.tsx`

## Validação

Preview a 1138px: rolar do topo ao rodapé e verificar que cada seção restante agora tem:
1. Cabeçalho em cascata com glow nos termos verdes
2. Cards entrando em sequência com destaque migrando
3. Auroras roxas respirando suavemente no fundo
4. Pricing: Pro continua visualmente proeminente o tempo todo

Conferir mobile (<768px) e `prefers-reduced-motion`.

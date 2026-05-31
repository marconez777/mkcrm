# Site institucional MK-CRM — plano em 7 etapas

Execução faseada. Cada etapa termina com **checkpoint visual** antes de seguir.

## Paleta locked (escolhida pelo usuário)

- **Preto puro** `#000000` → fundo (`--site-bg`)
- **Roxo profundo** `#590675` → acento secundário, gradientes, glow ambiente (`--site-accent`)
- **Verde neon** `#1ED400` → acento principal, CTAs, números, hover (`--site-primary`)
- Derivados: surface `#0A0A0A`, border `rgba(255,255,255,0.06)`, texto `#F5F5F5`, muted `#9A9A9A`.

Equivalentes HSL (vão no `index.css`):
- `--site-bg: 0 0% 0%`
- `--site-primary: 105 100% 42%` (verde `#1ED400`)
- `--site-accent: 285 94% 24%` (roxo `#590675`)
- `--site-primary-glow: 105 100% 55%`
- `--site-accent-glow: 285 90% 45%`

Combinações típicas:
- CTA pílula: fundo verde `#1ED400`, texto preto.
- Glow do hero: gradiente radial roxo `#590675` → transparente sobre preto.
- Hover em links: underline verde.
- Cards: surface `#0A0A0A` com borda hairline + halo roxo no hover.

---

## Etapa 1 — Fundação visual e roteamento

- `src/index.css` → tokens `--site-bg`, `--site-surface`, `--site-border`, `--site-text`, `--site-muted`, `--site-primary`, `--site-primary-glow`, `--site-accent`, `--site-accent-glow`; keyframes `marquee`.
- `tailwind.config.ts` → registrar todos como `site-*`, animação `marquee`.
- `index.html` → fontes Google Space Grotesk + Inter.
- `src/pages/site/MarketingSite.tsx` → shell com `<SiteNav/>` + `<SiteFooter/>` + placeholders.
- `SiteNav.tsx`, `SiteFooter.tsx` finais.
- `src/App.tsx` → rota pública `/site`; gate em `/` para deslogados.

**Checkpoint**: `/site` renderiza com navbar/footer no preto + verde, sem erro de console.

## Etapa 2 — Hero + Marquee

- `Hero.tsx`: título gigante branco, palavra-chave em verde, glow roxo radial atrás, CTA pílula verde, hero 3D.
- `Marquee.tsx`: faixa verde `#1ED400` com texto preto e `★`.
- `src/assets/site/hero-3d.png`: gerado (esferas escuras com reflexos verdes e halo roxo).

**Checkpoint**: hero impacta em 1440/1280/mobile; marquee suave.

## Etapa 3 — Sobre + Features

- `About.tsx`: 3 pilares com ícones em círculo (borda verde fina).
- `Features.tsx`: header outlined "NOSSAS FEATURES" (texto contornado roxo), 3 cards com imagem do produto.
- Assets: `feature-kanban.png`, `feature-inbox.png`, `feature-ia.png` gerados em paleta preto/verde/roxo.

**Checkpoint**: cards alinhados, hover com halo roxo.

## Etapa 4 — Serviços numerados + Integrações

- `ServicesList.tsx`: `(01)`–`(04)` em verde, expand-on-hover, imagem + tags.
- `Integrations.tsx`: grid de logos cinza → colorido no hover.
- Assets: `service-01..04.jpg`.

**Checkpoint**: interação dos serviços ok; grid responsivo.

## Etapa 5 — Depoimentos + Pricing + Blog placeholder

- `Testimonials.tsx`: aspas verdes gigantes, 3 cards.
- `Pricing.tsx`: 3 planos, preço verde gigante, plano do meio com borda roxa + glow.
- `BlogPlaceholder.tsx`: 3 cards "em breve".

**Checkpoint**: pricing destaca o plano central.

## Etapa 6 — Contato + polish

- `ContactForm.tsx`: headline esquerda + form direita, submit toast mockado.
- Polish: scroll suave âncoras navbar, focus rings verdes, `prefers-reduced-motion` desliga marquee, espaçamentos verticais.

**Checkpoint**: percorrer topo→footer sem regressão.

## Etapa 7 — QA visual + docs

- Screenshots em 360/768/1280/1440, checando overlap, clip, contraste (verde sobre preto = AAA; roxo é decorativo, nunca para texto).
- `rg "text-(white|black|slate|gray)-"` em `src/components/site` e `src/pages/site` → zero.
- Atualizar `docs/frontend/PAGES.md`, `ROUTING.md`, `CHANGELOG.md`.

**Checkpoint final**: aprovação para próxima rodada (conteúdo real + integrações).

---

## Regras transversais

- Cor só via token semântico — proibido `#000`, `#1ED400`, `text-white` em JSX.
- Roxo `#590675` é estritamente **acento ambiente** (gradientes, glow, bordas de destaque). **Nunca** usar como fundo de texto branco/cinza — contraste insuficiente.
- Verde `#1ED400` é a única cor de CTA e de acento de leitura (números, links ativos).
- Placeholder de copy marcado com `// TODO: copy final`.
- PNGs estáticos para 3D — nada de Three.js.
- Mobile-first; `alt` em toda imagem; `loading="lazy"` exceto hero.

## Fora de escopo

- Envio real do form (Resend).
- Copy/preços/depoimentos reais.
- Screenshots reais do produto.
- Animações Motion/scroll-triggered além do marquee.
- i18n.

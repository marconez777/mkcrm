# Adicionar atmosfera roxa nas seções intermediárias

Hoje só **Hero** e **Features** carregam o roxo `#590675` (`--site-accent`) com força — glows grandes de fundo e halos nos cards. As seções abaixo ficaram apenas pretas + verde, o que quebra a continuidade visual mostrada nos prints.

## Seções afetadas
1. **Serviços** (`O que entregamos`)
2. **Integrações nativas**
3. **Depoimentos** (`Quem já usa`)
4. **Planos** (`Pricing`)
5. **Blog / Central** (`Aprenda · Cresça`)

## O que muda em cada uma

Mantendo o padrão Hero/Features (radial roxo de fundo + halo roxo em hover nos cards), aplicar de forma consistente:

- **Glows de fundo**: aumentar tamanho/opacidade dos blobs roxos já existentes em Serviços/Depoimentos/Planos, e adicionar onde faltam (Integrações ganha glow roxo no lado oposto do verde; Blog ganha um blob roxo central no topo).
- **Halos roxos nos cards**: cada card das 5 seções recebe um `radial-gradient` roxo posicionado atrás dele que aparece/intensifica no `group-hover`, igual ao tratamento dos cards de Features.
- **Bordas/acentos no hover**: trocar `hover:border-site-primary/…` por um mix `hover:border-site-accent/60` em alguns elementos (badges de número em Serviços, ícones em Integrações), criando alternância verde↔roxo entre seções vizinhas.
- **Plano destaque (Pro)**: trocar o shadow verde por um shadow roxo (`shadow-[0_30px_80px_-30px_hsl(var(--site-accent)/0.55)]`) para dar peso de "premium" — o badge "Mais escolhido" continua verde.

## Regras

- Tudo via tokens semânticos (`--site-accent`, `--site-primary`). Nenhum hex no JSX.
- Só CSS/Tailwind — não mexer em conteúdo, estrutura, copy ou layout.
- Não adicionar novos assets de imagem.

## Arquivos editados

- `src/components/site/Services.tsx`
- `src/components/site/Integrations.tsx`
- `src/components/site/Testimonials.tsx`
- `src/components/site/Pricing.tsx`
- `src/components/site/Blog.tsx`

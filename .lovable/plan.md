## Objetivo

Criar uma documentação completa, em português, na pasta `docs/integracao/`, cobrindo todo o pipeline de integração entre o CRM e sites externos: snippets, tracking, formulários, eventos, atribuição, leads, segurança e troubleshooting.

## Estrutura proposta

```
docs/integracao/
├── README.md                       — índice + visão geral em 1 página
├── 01-visao-geral.md               — arquitetura ponta-a-ponta com diagramas
├── 02-instalacao-snippets.md       — passo-a-passo de instalação (HTML, WP, Wix, GTM, React/Next)
├── 03-tracking-eventos.md          — pixel, visitor_id, sessions, page_view, custom events, UTMs
├── 04-formularios.md               — captura de forms, field mapping, plugins WP, snippet auto-discovery
├── 05-atribuicao-leads.md          — UTMs, referrer, ctwa_clid, first/last touch, identity stitching
├── 06-eventos-customizados.md      — API JS (window.MK), data attributes, exemplos por caso de uso
├── 07-webhooks-api-direta.md       — external-lead-capture, tokens, payloads, exemplos cURL
├── 08-seguranca.md                 — tokens, allowed_domains, rotação, rate-limit, LGPD
├── 09-troubleshooting.md           — checklist DevTools, prompt de diagnóstico, erros comuns
├── 10-referencia-tecnica.md        — schemas Zod, contratos de payload, tabelas envolvidas, edge functions
└── exemplos/
    ├── html-puro.html
    ├── wordpress-cf7.php
    ├── wordpress-elementor.txt
    ├── react-nextjs.tsx
    ├── google-tag-manager.json
    └── api-direta-curl.sh
```

## Conteúdo de cada documento (alto nível)

**README.md** — índice, decision tree "qual integração eu preciso?", links para os outros docs, glossário rápido (visitor_id, session_id, anonymous_id, token, integration vs definition).

**01-visao-geral.md** — diagrama ASCII do fluxo completo (Visita → tracking-pixel → tracking-event → form submit → forms-ingest → lead → automação → CRM), explicação de cada componente, tabela "o que cada peça resolve".

**02-instalacao-snippets.md** — onde colar (`<head>` vs antes `</body>`), ordem (tracker antes do forms), código mínimo copy-paste para: HTML puro, WordPress (via header.php, plugin Insert Headers, ou plugin oficial), Wix, Webflow, Shopify, GTM, Next.js (`<Script strategy="afterInteractive">`), React SPA. Atributos `data-mk-*` documentados.

**03-tracking-eventos.md** — como funciona `_mk_vid` cookie, `_mk_sid` sessionStorage, eventos automáticos (page_view, page_exit, scroll, time_on_page), eventos custom via `window.MK.track('event_name', {props})`, captura de UTMs (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `fbclid`, `ctwa_clid`).

**04-formularios.md** — auto-discovery do snippet, field mapping (`data-mk-field="email"`), aliases automáticos (`name|nome`, `email|e-mail`, `phone|telefone|whatsapp`), regras de normalização (telefone BR, lowercase email), pre-fill via `data-mk-prefill`, redirect via `data-mk-redirect`, plugin WordPress (download via painel, shortcode, integração com CF7/WPForms), atributos especiais (`data-mk-ignore`, `data-mk-form="phq9"`, `data-mk-name`).

**05-atribuicao-leads.md** — modelo de identidade (visitor → lead via tracking-identify), backfill de eventos passados, first-touch vs last-touch, como o CRM agrupa por phone vs email vs visitor_id, tabela `tracking_identity_links`, deduplicação (mesmo phone = mesmo lead), atribuição de origem do WhatsApp via `ctwa_clid`.

**06-eventos-customizados.md** — API completa: `window.MK.track(name, props)`, `window.MK.identify(traits)`, `window.MK.page(properties)`, `window.MKForms.send(formEl)`. Casos de uso: tracking de cliques em CTA, tempo assistido em vídeo, scroll milestones, abandono de carrinho, leitura de artigo. Exemplos prontos.

**07-webhooks-api-direta.md** — quando usar `external-lead-capture` em vez do snippet (CRM próprio, integração server-to-server, n8n, Zapier, Make). Endpoint, autenticação (`x-external-token`), schema do payload, exemplos cURL/Node/Python, retry e idempotência.

**08-seguranca.md** — diferença entre token público (snippet) e token privado (webhook), rotação de tokens (com grace period), `allowed_domains` (regras de match incluindo subdomínio), rate-limit por integração, headers CORS, considerações LGPD (consentimento, opt-out, retenção), o que **não** logamos (passwords, números de cartão).

**09-troubleshooting.md** — fluxograma "meu lead não chegou": (1) snippet carregou? (2) form disparou submit? (3) chegou no forms-ingest? (4) lead foi criado? (5) automação rodou? Cada nó com como verificar (DevTools, painel, SQL). Inclui o **prompt de DevTools** que já criamos no diagnóstico anterior. Tabela de erros comuns: 401 invalid token, 403 origin not allowed, 400 invalid payload, lead duplicado, etc.

**10-referencia-tecnica.md** — schemas Zod dos endpoints (forms-ingest, tracking-event, tracking-identify, external-lead-capture), tabelas envolvidas (`form_integrations`, `form_definitions`, `form_submissions`, `tracking_visitors`, `tracking_sessions`, `tracking_events`, `tracking_identity_links`, `leads`, `lead_events`), lista de edge functions com responsabilidade de cada uma, limites (tamanho de payload, rate-limit), versionamento.

**exemplos/** — snippets prontos copy-paste para casos reais.

## Decisões

- **Idioma:** português (consistente com o produto e com o usuário).
- **Pasta:** `docs/integracao/` (sem acento no nome para evitar problema de URL/arquivo). O nome bonito "Integração" aparece nos títulos dos `.md`.
- **Não duplicar conteúdo:** onde já existe doc (`docs/integrations/EXTERNAL_FORMS.md`, `docs/TRACKING.md`, `docs/flows/TRACKING_TO_LEAD.md`), eu **referencio** em vez de copiar — mas a nova pasta é o ponto único de entrada para integradores externos.
- **Sem código novo no produto.** Só documentação. Nenhum `.ts/.tsx` é tocado.
- **Atualizar `docs/README.md`** apontando para a nova pasta.

## Não está escopo

- Refatoração do código de forms/tracking (proposta separada).
- Criação de novas edge functions ou endpoints.
- Tradução para inglês (pode vir depois).

## Tempo estimado

~11 arquivos de documentação. Vou escrever todos em paralelo no momento da execução.

---
title: 03 — Tracking & eventos
topic: tracking
kind: reference
audience: user
updated: 2026-06-07
summary: "O `tracking-pixel` envia sozinho:"
---
# 03 — Tracking & eventos

> **Pré-requisito:** snippet `tracking-pixel` instalado ([02](./02-instalacao-snippets.md)).

---

## Identidade do visitante

| Campo | Onde fica | TTL | Para quê |
|---|---|---|---|
| `_mk_vid` | Cookie + localStorage | 365 dias | Visitor ID — identifica o navegador |
| `_mk_sid` | sessionStorage | 30 min de inatividade | Session ID — janela de visita |
| `_mk_sid_exp` | sessionStorage | — | Expiração da sessão |
| `_mk_sid_sig` | sessionStorage | — | "Assinatura" da campanha; muda → nova sessão |

**Regra de sessão:** uma nova sessão é aberta quando:
- Passaram 30min sem evento (configurável por clinic).
- A pessoa volta com **UTMs diferentes** (ex.: vinha do Google, agora veio do Facebook).
- O storage foi limpo.

---

## Eventos automáticos

O `tracking-pixel` envia sozinho:

| Evento | Quando | Payload extra |
|---|---|---|
| `page_view` | Cada carregamento + cada mudança de rota em SPA | `url`, `title`, `referrer`, UTMs |
| `page_exit` | `beforeunload` / `visibilitychange=hidden` | `time_on_page_ms` |
| `session_start` | Início de uma nova sessão | UTMs, referrer, landing_page |

---

## UTMs e click IDs capturados

Lidos do `?...` da URL e propagados para todos os eventos da sessão:

```
utm_source, utm_medium, utm_campaign, utm_content, utm_term,
gclid, gbraid, wbraid, fbclid, ttclid, msclkid, li_fat_id
```

> 💡 O snippet **persiste** os UTMs da landing na sessionStorage. Se a pessoa navegar pra outra página sem `?utm_...`, os eventos seguintes continuam carimbados com o UTM original.

`ctwa_clid` (Click-to-WhatsApp) também é capturado e tem tratamento especial: o `evolution-webhook` usa para fazer o match na entrada da mensagem do WhatsApp.

---

## Eventos customizados (API JS)

Disponíveis em `window.MK`:

```js
// Track simples
window.MK.track("clicou_cta_hero", {
  cta_label: "Agendar consulta",
  variant: "B",
});

// Identificar (vincula visitor → lead manualmente)
window.MK.identify({
  email: "ana@example.com",
  phone: "+5511999998888",
  name: "Ana Silva",
});

// Page view manual (útil em SPAs onde o router não emite evento padrão)
window.MK.page({
  url: location.href,
  title: document.title,
});
```

Detalhes da API em [06 — Eventos customizados](./06-eventos-customizados.md).

---

## Cliques via data-attribute (sem código)

Adicione `data-mk-track="nome_do_evento"` em qualquer elemento:

```html
<button data-mk-track="clicou_whatsapp" data-mk-props='{"local":"footer"}'>
  Falar no WhatsApp
</button>

<a href="/agendar" data-mk-track="clicou_agendar">Agendar</a>
```

O snippet escuta `click` no `document` em capture, então funciona mesmo para elementos criados dinamicamente.

---

## Filtros embutidos (anti-bot)

O `tracking-pixel` **não envia evento** se detectar:
- `navigator.webdriver === true`
- User-agent matching `bot|crawler|spider|lovable|headlesschrome|prerender|phantomjs|puppeteer|playwright|facebookexternalhit|whatsapp|googlebot|...`

Isso reduz ruído em métricas. Se você precisa rastrear um headless legítimo, abra exceção no `_shared/attribution.ts`.

---

## Limites

| Limite | Valor |
|---|---|
| Eventos por minuto por (IP + clinic) | 60 |
| Tamanho do payload | 64 KB |
| Tamanho de `properties` por evento | 8 KB |

Excedeu → resposta `429`. O snippet retenta com backoff.

---

## Tabelas resultantes

| Tabela | Conteúdo |
|---|---|
| `tracking_visitors` | 1 linha por `visitor_id` (com first/last seen, UTMs do first touch) |
| `tracking_sessions` | 1 linha por sessão |
| `tracking_events` | 1 linha por evento (page_view, click, custom) |
| `tracking_identity_links` | Liga `visitor_id` ↔ `lead_id` (criado no submit do form ou via `identify`) |

Detalhes em [10 — Referência técnica](./10-referencia-tecnica.md).

---

## Próximo passo

➡ [04 — Formulários](./04-formularios.md)

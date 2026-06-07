---
title: 06 — Eventos customizados
topic: tracking
kind: reference
audience: user
updated: 2026-06-07
summary: Disponível assim que o `tracking-pixel` carrega.
---
# 06 — Eventos customizados

> Como rastrear eventos sob medida — cliques, milestones, abandonos.

---

## API `window.MK`

Disponível assim que o `tracking-pixel` carrega.

### `MK.track(event, properties?)`

```js
window.MK.track("clicou_cta_hero", {
  cta_label: "Agendar",
  variant: "B",
  position: "hero",
});
```

- `event` — string, snake_case recomendado, max 64 chars.
- `properties` — objeto JSON, max 8 KB.

### `MK.identify(traits)`

```js
window.MK.identify({
  email: "ana@x.com",
  phone: "+5511999998888",
  name: "Ana",
  // qualquer outro trait
  plan: "premium",
});
```

Vincula visitor → lead. Idempotente.

### `MK.page(properties?)`

```js
window.MK.page({ url: location.href, title: document.title });
```

Útil em SPAs que mudam de rota sem reload — chame após cada navegação do router. Se você usa Next.js App Router ou React Router v6+, ele já dispara `popstate` que o tracker escuta sozinho.

### `MKForms.send(formElement)`

Forçar envio de um `<form>` manualmente:

```js
const f = document.querySelector("#meu-form");
window.MKForms.send(f);
```

Útil quando você precisa enviar **antes** do submit (ex.: passo intermediário de wizard).

---

## Fila offline / fila pré-load

Se você chamar `MK.track(...)` **antes** do script terminar de carregar, a chamada vai pra fila:

```html
<script>
  window.MK = window.MK || { _q: [] };
  window.MK.track = function(){ MK._q.push(["track", arguments]); };
  window.MK.identify = function(){ MK._q.push(["identify", arguments]); };
  window.MK.page = function(){ MK._q.push(["page", arguments]); };
</script>
<script async src=".../tracking-pixel?project_id=..."></script>
```

Quando o tracker real carrega, ele drena `MK._q` e re-executa em ordem.

---

## Tracking declarativo (HTML puro)

Para casos simples, sem JS:

```html
<!-- Clique -->
<button data-mk-track="clicou_whatsapp" data-mk-props='{"local":"footer"}'>
  WhatsApp
</button>

<!-- Submit de form (já é capturado, este é só rename) -->
<form data-mk-form="orcamento" data-mk-name="Pedido de orçamento">
  ...
</form>
```

---

## Receitas prontas

### 1. CTA de WhatsApp

```html
<a href="https://wa.me/5511999998888" data-mk-track="clicou_whatsapp"
   data-mk-props='{"page":"home","posicao":"hero"}'>
  Falar no WhatsApp
</a>
```

### 2. Scroll milestones

```js
let last = 0;
window.addEventListener("scroll", () => {
  const p = (window.scrollY + innerHeight) / document.body.scrollHeight;
  const m = Math.floor(p * 4) * 25; // 25, 50, 75, 100
  if (m > last && m <= 100) {
    last = m;
    window.MK?.track("scroll_milestone", { percent: m });
  }
}, { passive: true });
```

### 3. Tempo no vídeo

```js
const v = document.querySelector("video");
let sent = new Set();
v.addEventListener("timeupdate", () => {
  const p = Math.floor(v.currentTime / v.duration * 4) * 25;
  if (!sent.has(p) && p > 0) {
    sent.add(p);
    window.MK?.track("video_progress", { percent: p, src: v.currentSrc });
  }
});
```

### 4. Leitura de artigo (60s + scroll 50%)

```js
let timer = setTimeout(() => {
  if (window.scrollY > innerHeight * 0.5) {
    window.MK?.track("artigo_lido", { slug: location.pathname });
  }
}, 60000);
```

### 5. Abandono de form

```js
const f = document.querySelector("form#contato");
let touched = false;
f.addEventListener("input", () => { touched = true; });
window.addEventListener("beforeunload", () => {
  if (touched && !f.dataset.submitted) {
    window.MK?.track("form_abandonado", { form_id: f.id });
  }
});
```

---

## Boas práticas de naming

| ✅ | ❌ |
|---|---|
| `clicou_agendar_consulta` | `Click Agendar !!!` |
| `video_progress` (com `percent` em props) | `video_25`, `video_50` (3 eventos diferentes) |
| `checkout_iniciou` / `checkout_concluiu` | `checkout1`, `checkout2` |

Padronize **snake_case** e use `properties` para variações.

---

## Próximo passo

➡ [07 — Webhooks & API direta](./07-webhooks-api-direta.md)

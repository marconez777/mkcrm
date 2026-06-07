---
title: 09 — Troubleshooting
topic: integracao
kind: reference
audience: user
updated: 2026-06-07
summary: "Cole no DevTools Console do site:"
---
# 09 — Troubleshooting

> "Meu lead não chegou" — siga este fluxograma antes de abrir suporte.

---

## Fluxograma "lead não chegou"

```text
Lead não apareceu no CRM
        │
        ▼
[1] Snippet carregou no site?
    ├─ NÃO → corrigir <script> no <head>. Ver seção "Verificar snippet".
    └─ SIM
        ▼
[2] O <form> dispara evento `submit`?
    ├─ NÃO → form usa JS custom (button type=button + fetch).
    │        Workaround: chamar window.MKForms.send(form) no handler.
    │        Ou usar API direta (cap 07).
    └─ SIM
        ▼
[3] POST para /forms-ingest saiu? (Network tab)
    ├─ NÃO → snippet com bug, ou form com preventDefault sem nosso listener.
    └─ SIM
        ▼
[4] Resposta foi 200?
    ├─ 401 → token errado. Conferir painel.
    ├─ 403 → "origin not allowed" → adicionar domínio em allowed_domains.
    ├─ 400 → payload inválido. Ver "Erros de schema".
    ├─ 5xx → erro no servidor. Olhar logs (Supabase → Edge Functions).
    └─ 200
        ▼
[5] form_submissions tem o registro?
    ├─ NÃO → impossível (200 sempre grava). Conferir logs.
    └─ SIM
        ▼
[6] status do submission?
    ├─ "no_contact" → faltou email E phone no payload.
    ├─ "error" → ver coluna `error` da row. Geralmente erro em trigger/automação.
    └─ "ok"
        ▼
[7] leads tem o lead?
    ├─ NÃO → bug. Reportar com submission_id.
    └─ SIM → aparece no CRM. Procure no kanban, inbox, ou /leads.
```

---

## Verificar snippet (em 30s)

Cole no DevTools Console do site:

```js
(function(){
  var snippets = Array.from(document.scripts).map(s => s.src).filter(Boolean);
  console.log("Tracker:", snippets.filter(s => s.includes("tracking-pixel")));
  console.log("Forms:", snippets.filter(s => s.includes("forms-snippet")));
  console.log("MK API:", typeof window.MK, typeof window.MKForms);
  console.log("_mk_vid cookie:", document.cookie.match(/_mk_vid=([^;]+)/)?.[1] || "ausente");
})();
```

Tudo deve aparecer não-vazio.

---

## Prompt completo de diagnóstico

Cole isto **antes** de submeter o form que está dando problema. Vai capturar tudo:

```js
(function diag(){
  console.group("%c[MK-DIAG]", "background:#0a0;color:#fff;padding:2px 6px;font-weight:700");

  // 1) Snippets
  var s = Array.from(document.scripts).map(x => x.src).filter(Boolean);
  console.log("1) tracker:", s.filter(x => x.includes("tracking-pixel")) || "❌");
  console.log("   forms:  ", s.filter(x => x.includes("forms-snippet")) || "❌");
  console.log("2) window.MK?", typeof window.MK, "MKForms?", typeof window.MKForms);

  // 3) Forms na página
  var forms = document.querySelectorAll("form");
  console.log("3) <form>s:", forms.length, forms);

  // 4) iframes
  var ifr = document.querySelectorAll("iframe");
  console.log("4) <iframe>s:", ifr.length, Array.from(ifr).map(i => i.src || "(sem src)"));

  // 5) Botões candidatos
  var btns = Array.from(document.querySelectorAll('button, input[type=submit], [role=button]'))
    .filter(b => /enviar|finalizar|ver result|concluir|próxim/i.test(b.textContent||b.value||""));
  console.log("5) Botões 'enviar':", btns);

  // 6) Hooks
  document.addEventListener("submit", e => console.log("✅ submit:", e.target), true);
  document.addEventListener("click",  e => {
    var b = e.target.closest("button,input[type=submit],[role=button]");
    if (b) console.log("🖱️ click:", b);
  }, true);

  // 7) Intercepta fetch e XHR
  var of = window.fetch;
  window.fetch = function(u,o){ console.log("🌐 fetch →", u, o); return of.apply(this,arguments); };
  var xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m,u){ console.log("🌐 XHR →", m, u); return xo.apply(this,arguments); };

  // 8) Cookie
  console.log("8) _mk_vid:", document.cookie.match(/_mk_vid=([^;]+)/)?.[1] || "❌");

  console.groupEnd();
  console.log("%cAgora envie o form e observe os logs.", "color:#0a0;font-weight:700");
})();
```

**O que olhar depois de enviar:**
- Apareceu `✅ submit`? → snippet **deveria** ter capturado. Se não chegou no CRM, é bug — abrir issue.
- Apareceu só `🖱️ click` mas nenhum `submit`? → form não dispara submit nativo. Veja "Form com botão custom" abaixo.
- Apareceu `🌐 fetch` para um endpoint terceiro (não nosso)? → o form envia via AJAX próprio. Veja "Workaround AJAX" abaixo.
- Nada apareceu? → o botão "enviar" não é nem button nem input nem tem role=button. Inspecionar o DOM.

---

## Erros comuns

### `401 invalid token`

Causa: token errado ou copiado com espaço.
Fix: copie de novo no painel. Cuidado com prefixo `Bearer`.

### `403 origin not allowed`

Causa: o domínio que carregou o snippet não está em `allowed_domains`.
Fix:
- Adicione o domínio no painel da integração.
- Para preview (ex.: `*.lovable.app`), adicione `lovable.app` ou o subdomínio exato.
- **Atenção:** quando você abre o site direto pelo `file://` o `Origin` vem `null` → o snippet aceita; mas em produção não vai funcionar até cadastrar.

### `400 invalid payload`

Causa: schema Zod rejeitou. Olhe `error.fieldErrors` na resposta.
Fixes comuns:
- `visitor_id: null` enviado quando o schema espera `undefined` → cookie `_mk_vid` ainda não foi setado (tracker não carregou). Carregue tracker antes do forms.
- `email` malformado → o snippet só aceita `[^@]+@[^@]+\.[^@]+`.

### `status="no_contact"` na submission

Causa: nem `email` nem `phone` puderam ser extraídos dos campos.
Fix:
- Adicione `data-mk-field="email"` ou `data-mk-field="phone"` no input.
- Confira `name=` do input — está em algum alias da seção 04?

### `enqueue_email is not unique` (histórico)

Causa: overload duplicado da função `enqueue_email` no banco.
Status: **resolvido** em 2026-05-26 (migration de fix de overload).

### Form com botão custom (sem submit nativo)

Cenário:
```html
<button type="button" onclick="enviarQuiz()">Ver resultado</button>
```

Workaround:
```js
function enviarQuiz() {
  // ... sua lógica original ...

  // Força o forms-snippet a capturar
  const form = document.querySelector("#quiz-phq9");
  window.MKForms?.send(form);

  // ... ou: chame a API direta (cap 07) do seu backend ...
}
```

### Workaround AJAX (form envia via fetch próprio)

Adicione um hook que dispara o snippet também:

```js
const original = window.suaFuncaoDeEnvio;
window.suaFuncaoDeEnvio = function(dados) {
  // Cria form virtual pro MKForms
  const f = document.createElement("form");
  Object.entries(dados).forEach(([k,v]) => {
    const i = document.createElement("input");
    i.name = k; i.value = v;
    f.appendChild(i);
  });
  f.setAttribute("data-mk-form", "meu-quiz");
  window.MKForms?.send(f);

  return original.apply(this, arguments);
};
```

---

## Onde olhar logs

| Sistema | Onde |
|---|---|
| Edge function (forms-ingest, etc.) | Painel Supabase → Edge Functions → Logs |
| Submissions | Painel CRM → Forms → Integração → aba "Envios" |
| Erros JS no browser | DevTools Console |
| Network (request/response) | DevTools Network → filtrar por `forms-ingest` |

---

## Pedir ajuda

Mande para o suporte com:
1. `integration_id` (vem na URL do painel).
2. Print do DevTools Console com o prompt acima rodado.
3. Print do DevTools Network filtrando por `forms-ingest`.
4. Horário aproximado da tentativa (UTC).

---

## Próximo passo

➡ [10 — Referência técnica](./10-referencia-tecnica.md)

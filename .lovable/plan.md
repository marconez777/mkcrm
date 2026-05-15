# Caminho B: pixel prefere `window.lvTrack.sessionId`

## Mudança no `tracking-pixel/index.ts`

Substituir a linha que define `sid`:

```js
var sid = (window.lvTrack && window.lvTrack.sessionId) || localStorage.getItem(STORE_KEY) || uuid();
localStorage.setItem(STORE_KEY, sid);
var refShort = sid.replace(/-/g,'').slice(0,10);
```

Como `lvTrack` é injetado por outro `<script>`, há risco de o pixel rodar antes. Solução: pequeno polling (até 1s) antes do primeiro `pageview`/scan:

```js
function start(){
  var sid = (window.lvTrack && window.lvTrack.sessionId) || localStorage.getItem(STORE_KEY) || uuid();
  localStorage.setItem(STORE_KEY, sid);
  // ... resto do script atual usando `sid` e `refShort`
}
var tries = 0;
(function wait(){
  if (window.lvTrack && window.lvTrack.sessionId) return start();
  if (tries++ > 20) return start(); // ~1s de espera máx
  setTimeout(wait, 50);
})();
```

Efeitos:
- `tracking-ingest` recebe `sessionId = lvTrack.sessionId` → `ref_short` derivado bate com o `(ref=...)` que o tracker do site injeta no link.
- Se `lvTrack` nunca aparecer (site sem o tracker próprio), cai no `mk_sid` antigo — sem regressão.
- `payload.phone_e164` continua vindo do nosso pixel (já implementado).

## Deploy

Deploy de `tracking-pixel`. As páginas com cache de 5min renovam automaticamente.

## Prompt para o projeto do site da clínica

Texto pronto para colar no outro projeto Lovable:

> **Contexto:** o site usa um tracker próprio em `/tracker.js` que define `window.lvTrack = { sessionId: "<uuid>" }` e injeta `(ref=<10chars>)` no `text=` dos links de WhatsApp (`wa.me` / `api.whatsapp.com`), onde `<10chars>` = `lvTrack.sessionId.replace(/-/g,'').slice(0,10)`.
>
> **O que precisa ser garantido:**
> 1. `window.lvTrack` e `window.lvTrack.sessionId` precisam estar disponíveis **antes** de qualquer outro script de tracking rodar (inclusive o pixel do CRM, que é carregado por `<script src=".../functions/v1/tracking-pixel?t=TOKEN">`). Coloque o `<script src="/tracker.js">` **antes** do script do pixel no `<head>`, idealmente sem `defer`/`async`, ou garanta que ambos sejam síncronos na mesma ordem.
> 2. O `sessionId` deve ser **estável por sessão de navegador** (persistir em `localStorage` com a mesma chave usada hoje, ex.: `lv_sid`). Não regenerar a cada page load.
> 3. O ref injetado nos links de WhatsApp deve seguir exatamente: `(ref=<sessionId.replace(/-/g,'').slice(0,10)>)`. Não mudar o formato (regex do CRM espera `\bref[=:]\s*([A-Za-z0-9]{6,32})`).
> 4. Se o usuário navegar via SPA (pushState), o tracker deve re-injetar o ref nos novos links renderizados (MutationObserver já cobre isso no pixel do CRM, mas o tracker do site precisa garantir o mesmo comportamento se reescrever links).
>
> **O que NÃO precisa mudar:** ingestão de eventos do `lvTrack.track()` continua na tabela `events` do site. O CRM só lê o `ref` do texto da 1ª mensagem do WhatsApp.
>
> **Teste de aceitação:** abrir o site, inspecionar um link `wa.me`, conferir que `text` termina com `(ref=XXXXXXXXXX)` onde `XXXXXXXXXX === window.lvTrack.sessionId.replace(/-/g,'').slice(0,10)`.

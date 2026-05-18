## Problema

O pixel do site da OHR (e de qualquer clínica) está sendo bloqueado por CORS quando usa `navigator.sendBeacon`. O Chrome trata o sendBeacon como request com credenciais (cookies), e nosso edge function responde com `Access-Control-Allow-Origin: *` — combinação não permitida. Resultado: o POST nunca chega, nenhum evento é registrado. Confirmado via console: `"...must not be the wildcard '*' when the request's credentials mode is 'include'"`.

Sintoma observado: nenhum `tracking_events` após 20:10 UTC, apesar de visitas reais. Os 2 preflights `OPTIONS` chegaram, mas zero `POST`.

## Plano

### 1) Ajustar o pixel (`supabase/functions/tracking-pixel/index.ts`) para enviar como "simple request"
Trocar o tipo do Blob no `sendBeacon` de `application/json` para `text/plain;charset=UTF-8`. Isso é uma request CORS-safelisted: sem preflight, sem exigência de Allow-Credentials, e o servidor continua lendo o body como JSON normalmente (`await req.json()` funciona porque o conteúdo é JSON válido — o `Content-Type` é só metadata).

```js
var blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
```

Também manter o fallback `fetch` atual com `credentials: "omit"`, mas trocar o `Content-Type` para `text/plain;charset=UTF-8` para evitar preflight também no fallback (mais rápido, mais robusto).

### 2) Reforçar CORS do `tracking-event` para refletir Origin
Mesmo com o ajuste do pixel, deixar a edge function mais resiliente: responder o header `Access-Control-Allow-Origin` com o valor do `Origin` da request (em vez de `*`) e adicionar `Vary: Origin`. Assim, mesmo se algum cliente futuro enviar com credenciais, o CORS passa.

Mudança em `tracking-event/index.ts` (e replicar em `tracking-identify` e `tracking-config`): substituir o objeto `cors` constante por um helper `corsFor(req)` chamado em cada resposta.

### 3) Redeploy
`tracking-pixel`, `tracking-event`, `tracking-identify`, `tracking-config`. Como o pixel tem `Cache-Control: no-store`, os sites pegam a versão nova na próxima visita sem precisar invalidar nada.

### 4) Validar
- Visitar `https://clinicaohrpsiquiatria.com/` em janela anônima
- Confirmar no console: sem erros de CORS
- Conferir no banco: novo `tracking_events` inserido
- Confirmar que a página `/tracking` mostra a nova visita

## Detalhes técnicos

- `sendBeacon` com Blob `text/plain` é "simple CORS" (sem preflight). O Chrome envia cookies do site, mas como o servidor não exige Allow-Credentials, não há conflito com `*`.
- `await req.json()` no Deno só olha o body — não valida `Content-Type`. Já é assim que muitos pixels (Plausible, Umami) operam.
- Refletir Origin é boa prática para edges públicas de tracking; mantém compatibilidade futura com qualquer cliente.

## Fora de escopo

- Não vou mexer em atribuição/regras/UI agora — só corrigir o transporte.
- Sessões antigas sem `source/medium` continuam como estão (decisão anterior).
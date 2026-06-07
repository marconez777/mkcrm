---
title: CORS no `forms-ingest` (e qualquer edge function chamada por snippet em site externo)
topic: tracking
kind: reference
audience: agent
updated: 2026-06-07
summary: "No console do site externo (ex.: `clinicaohrpsiquiatria.com`):"
---
# CORS no `forms-ingest` (e qualquer edge function chamada por snippet em site externo)

> Última atualização: 2026-06-03
> Sintoma reincidente — sempre revisitar esta nota antes de mexer no CORS do
> `forms-ingest`, `tracking-event`, `tracking-identify`, `tracking-config`, `tracking-pixel`
> ou qualquer função pública servida via JS snippet em domínio de terceiro.

## Sintoma

No console do site externo (ex.: `clinicaohrpsiquiatria.com`):

```
Access to resource at 'https://<ref>.supabase.co/functions/v1/forms-ingest?token=...'
from origin 'https://clinicaohrpsiquiatria.com' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
The value of the 'Access-Control-Allow-Origin' header in the response must not
be the wildcard '*' when the request's credentials mode is 'include'.

POST https://<ref>.supabase.co/functions/v1/forms-ingest?... net::ERR_FAILED
```

A submissão **nunca chega** no backend — não aparece em `form_submissions`,
não cria lead, e o teste interno (`lovable-test@example.com` same‑origin)
funciona normalmente, o que mascara o bug.

## Causa raiz

A spec de CORS proíbe `Access-Control-Allow-Origin: *` quando a requisição
viaja com credenciais (cookies / `credentials: 'include'`). Nosso snippet
envia via `navigator.sendBeacon` (que **sempre** anexa cookies do domínio do
site externo) e tem fallback `fetch` que pode usar `credentials: 'include'`.
Resultado: o preflight `OPTIONS` é rejeitado pelo browser antes mesmo de
chegar no nosso código.

## Correção (padrão a seguir SEMPRE)

Não usar `corsHeaders` constante com `*`. Construir os headers por request,
ecoando o `Origin`:

```ts
function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-form-token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin", // cache correto por origem
  };
  if (origin) {
    base["Access-Control-Allow-Origin"] = origin;            // ecoa exato
    base["Access-Control-Allow-Credentials"] = "true";
  } else {
    base["Access-Control-Allow-Origin"] = "*";               // server‑to‑server
  }
  return base;
}
```

Aplicar `buildCors(req)` em **todas** as respostas, inclusive `OPTIONS` e
erros (401/403/400/405).

## Por que NÃO mexer no snippet

- `navigator.sendBeacon` não tem API para desligar credenciais.
- O header customizado `x-form-token` já força preflight; remover ele perde
  a autenticação por integração.
- Mexer no snippet quebraria todos os sites já instalados.

A correção fica 100% no servidor (edge function).

## Checklist antes de criar/editar edge function pública

- [ ] `Access-Control-Allow-Origin` ecoa `req.headers.get("origin")` (nunca `*` quando há credenciais).
- [ ] `Access-Control-Allow-Credentials: true` presente quando ecoa origem.
- [ ] `Vary: Origin` presente.
- [ ] `Access-Control-Allow-Headers` lista **todos** os headers customizados que o snippet manda (ex.: `x-form-token`, `x-mk-visitor`).
- [ ] OPTIONS responde com os mesmos headers (200/204).
- [ ] Respostas de erro (401/403/400/500) também carregam os headers de CORS — sem isso o browser mostra "CORS error" em vez do erro real.
- [ ] Testar do domínio externo real (não só same‑origin do CRM).

## Funções afetadas / a auditar

- `supabase/functions/forms-ingest/index.ts` — **corrigido em 2026-05-26**.
- `supabase/functions/tracking-event/index.ts`, `tracking-identify/index.ts`,
  `tracking-config/index.ts`, `tracking-pixel/index.ts` — auditar mesmo padrão.
- Qualquer função futura servida via `forms-snippet` ou `tracking-snippet`.

## Como reproduzir / validar

1. Abrir o site externo com DevTools → Network.
2. Submeter o formulário.
3. Conferir preflight `OPTIONS /functions/v1/forms-ingest`:
   - `Access-Control-Allow-Origin: https://<origem-do-site>` (não `*`).
   - `Access-Control-Allow-Credentials: true`.
4. POST seguinte deve retornar `200 { ok: true, status: "ok", lead_id: ... }`.
5. CRM: lead aparece em **Pipeline → Formulário Site → Novo** e contato em
   **Email → Contatos** (segmento `Leads Site`).

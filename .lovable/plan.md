## Resposta aos 3 pontos abertos do Gate D

### Ponto 1 — payload real do tracking-claim (Gate C)

A delivery `e9dd5e61…` que usei no Gate D foi um insert manual meu **só para exercitar o HMAC**, e por isso veio enxuta. Ela **não representa** o que o `tracking-claim` produz.

A delivery real enfileirada na Fase C é `88c8a6ba-a612-4d7a-95d9-726c2d4d7048`. O body dela em `external_webhook_deliveries.payload`, exatamente como está hoje no banco, é:

```json
{
  "type": "lead.matched",
  "event_id": "678e241d-3591-4c3c-bb90-29d465a3141f",
  "occurred_at": "2026-05-17T16:45:48.074575+00:00",
  "schema_version": 1,
  "lead": {
    "crm_lead_id": "d0b4185f-547d-424c-b135-09c9c4232f08",
    "ref_short": "test123456",
    "phone_e164": "+5511999999000",
    "name": "Gate C Test",
    "email": null
  },
  "data": {
    "first_message": "oi, vim do site (ref=test123456)",
    "first_message_at": "2026-05-17T16:45:48.074575+00:00"
  }
}
```

Ou seja: `type`, `occurred_at`, `crm_lead_id`, `phone_e164`, `name`, `email` **estão todos presentes**. O `tracking-claim` está cumprindo o contrato — quem estava errado era o body de teste do dispatcher.

### Ponto 3 antecipado — `type` no body ou só no header?

Como o body real **já tem** `type`, minha proposta é manter **redundância** (body + header `X-CRM-Event`). O site pode validar qualquer um — recomendado preferir o do body (assinado dentro do HMAC) e usar o header só como dica de roteamento. Aguardo seu OK pra registrar isso no contrato.

### O que vou rodar agora (re-Gate D)

Antes de fechar Gate D, vou:

1. **Re-enqueue + dispatch da delivery real `88c8a6ba…`** (depois de resetar pra `pending`). Mostrar:
   - body raw enviado (= JSON acima)
   - `signed = v1:${ts}:${body}` completo
   - todos os headers
   - **response body do site** (não só status), via captura do `respText` no dispatcher (já existe, só preciso logar)
2. **Teste negativo A — tamper signature**: chamar manualmente o endpoint do site com `X-CRM-Signature` com 1 char trocado → esperar 401.
3. **Teste negativo B — timestamp velho**: chamar com `X-CRM-Timestamp` de 10min atrás (assinatura recalculada com esse ts) → esperar 401.
4. **Teste negativo C — idempotência**: chamar 2x com mesmo `event_id` (a delivery já tem) → 1ª `matched_session:false` (ref `test123456` não existe no site), 2ª `dedup:true`. Verificar via `read_query` no lado CRM que não há duplicidade (a checagem real é no site).

Esses 3 testes negativos rodo direto via `curl` (fora do dispatcher) reusando o mesmo `webhook_secret_out` da ÓR, montando os headers à mão. Não tocam nenhum arquivo.

Pequena alteração de código necessária: ampliar o log do dispatcher para incluir `respText` no `console.log("ewd sent", …)` quando `DEBUG_HMAC=1`. Sem isso, só temos o status. Removo depois junto com o resto do debug.

---

## Fase E — `get-lead-journey` assinado

Plano de implementação:

**Arquivo:** `supabase/functions/get-lead-journey/index.ts` (verificar se já existe; se não, criar do zero seguindo o padrão do dispatcher).

1. **Resolver `webhook_secret_out`** da `tracking_sites` correspondente ao lead (via `leads.site_id → tracking_sites.webhook_secret_out`). Sem secret → 502 `no_signing_secret`.
2. **Resolver URL do site**: `https://<tracking_sites.domain>/functions/v1/crm-lead-journey?ref_short=<lead.ref_short>` (ou conforme contrato; query string é o material assinado).
3. **Assinar GET**: `signed = "v1:" + ts + ":" + url.search` (incluindo o `?`, em UTF-8). HMAC-SHA-256 → hex lowercase, mesma função `hmacSha256Hex` do dispatcher.
4. **Headers enviados**:
   - `X-CRM-Timestamp: <unix seconds>`
   - `X-CRM-Signature: v1=<hex>`
   - `Accept: application/json`
   - (sem `X-CRM-Event` / `X-CRM-Event-Id` — não há evento, é leitura)
5. **Timeout 10s**, sem retry (chamada síncrona, é leitura). Em erro retornar `{ ok:false, error }` com status apropriado.
6. **Retorno** do edge para o cliente CRM: o JSON do site como está (`{ journey: […] }` ou o que vier), mais metadados mínimos.

**Gate E** vou mostrar:
- URL final chamada (com query string)
- headers exatos (incluindo `signed` recomputado pra você validar com Python)
- response body JSON do site

Sem mudanças de schema. Sem alterar dispatcher / tracking-claim / tracking-pixel.

---

## Ordem de execução

1. Logar `respText` no dispatcher (1 linha) + redeploy.
2. Re-dispatch `88c8a6ba…` → mostrar body real + headers + response body do site.
3. Rodar testes negativos A/B/C via `curl` manual.
4. **Pausa para seu OK no Gate D final + decisão `type` redundante.**
5. Implementar `get-lead-journey` conforme acima.
6. **Pausa no Gate E** com URL/headers/response.

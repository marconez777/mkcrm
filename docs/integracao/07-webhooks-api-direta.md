---
title: 07 — Webhooks & API direta
topic: integracao
kind: reference
audience: user
updated: 2026-06-07
summary: "Headers: ``` Content-Type: application/json x-capture-token: <TOKEN_PRIVADO> ```"
---
# 07 — Webhooks & API direta

> Para integrar **sem JS no browser**: Zapier, n8n, Make, CRMs próprios, chatbots, automações server-to-server.

---

## Endpoint

```
POST https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/external-lead-capture
```

Headers:
```
Content-Type: application/json
x-capture-token: <TOKEN_PRIVADO>
```

> ⚠ O `x-capture-token` é **privado** — nunca exponha em código de browser. Se vazar, peça rotação ao admin.

---

## Payload

```json
{
  "clinic_id": "uuid-da-clinica",
  "visitor_id": "v_abc...",          // opcional
  "session_id": "s_xyz...",          // opcional
  "name": "Ana Silva",               // opcional
  "email": "ana@example.com",        // opcional (mas precisa de pelo menos 1: email OU phone)
  "phone": "+5511999998888",         // opcional
  "source_page": "https://...",      // opcional
  "form_kind": "landing_quiz_phq9",  // opcional, vira form_source no lead
  "extra": {                         // opcional, JSON livre, max 8KB
    "score": 18,
    "answers": [3, 2, 1, 2, 3, 0, 1, 2, 3]
  }
}
```

**Regra mínima:** `email` OU `phone` é obrigatório.

---

## Respostas

### Sucesso (200)

```json
{
  "ok": true,
  "lead_id": "uuid",
  "is_new_lead": true,
  "merged": false
}
```

`is_new_lead: false` significa que o lead já existia e foi atualizado.

### Erros comuns

| Status | Body | Causa |
|---|---|---|
| 400 | `{"error": {"formErrors":[...]}}` | Payload inválido (faltou email/phone, formato errado) |
| 401 | `{"error":"unauthorized"}` | Token errado ou ausente |
| 405 | `{"error":"method not allowed"}` | Use POST |
| 500 | `{"error":"..."}` | Erro interno — retentar com backoff |

---

## Exemplos

### cURL

```bash
curl -X POST 'https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/external-lead-capture' \
  -H 'Content-Type: application/json' \
  -H 'x-capture-token: SEU_TOKEN_PRIVADO' \
  -d '{
    "clinic_id": "00000000-0000-0000-0000-000000000000",
    "name": "Ana Silva",
    "email": "ana@example.com",
    "phone": "+5511999998888",
    "source_page": "https://meusite.com/quiz",
    "form_kind": "quiz_phq9",
    "extra": { "score": 18 }
  }'
```

### Node.js (fetch)

```js
await fetch("https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/external-lead-capture", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-capture-token": process.env.MK_TOKEN,
  },
  body: JSON.stringify({
    clinic_id: process.env.MK_CLINIC_ID,
    name, email, phone,
    source_page: "https://app.meucrm.com/lead-form",
    form_kind: "crm_manual",
  }),
});
```

### Python

```python
import requests, os
requests.post(
  "https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/external-lead-capture",
  headers={
    "Content-Type": "application/json",
    "x-capture-token": os.environ["MK_TOKEN"],
  },
  json={
    "clinic_id": os.environ["MK_CLINIC_ID"],
    "email": "ana@example.com",
    "phone": "+5511999998888",
  },
  timeout=10,
)
```

### Zapier

1. Trigger: o que você quiser (Google Forms, Typeform, Calendly, etc.).
2. Action: **Webhooks by Zapier → POST**.
3. URL: o endpoint acima.
4. Payload Type: **JSON**.
5. Data: mapeie os campos. Em **Headers**: adicione `x-capture-token` e `Content-Type`.

### n8n

Nó **HTTP Request**:
- Method: POST
- URL: endpoint
- Authentication: **Header Auth** com `x-capture-token`
- Body: JSON conforme acima

---

## Idempotência

A API é **idempotente por contato**:
- Mesmo email/phone → mesmo lead, com merge de campos vazios.
- Você pode chamar 100 vezes — só cria 1 lead, mas registra 100 eventos no histórico do lead.

Para evitar gerar 100 eventos, **deduplicate no seu lado** (não chame se nada mudou).

---

## Retry recomendado

```text
Tentativa 1: imediata
Tentativa 2: +2s
Tentativa 3: +8s
Tentativa 4: +30s
Desistir após 4 tentativas → log para review
```

Retentar **apenas** em `5xx` e erros de rede. **Não** retentar `4xx` (payload está errado, retentar não muda nada).

---

## Diferenças entre os 3 endpoints

| | `forms-ingest` | `external-lead-capture` | `tracking-event` |
|---|---|---|---|
| Auth | Token público + allowed_domains | Token privado | Sem auth |
| Pra que serve | Form de site | API server-to-server | Eventos comportamentais |
| Cria lead? | Sim | Sim | Não |
| Loga `tracking_event`? | Não (loga `lead_event`) | Não | Sim |
| CORS | Open | Open | Open |
| Idempotente? | Sim (por contato) | Sim (por contato) | Não (cada evento é novo) |

---

## Próximo passo

➡ [08 — Segurança](./08-seguranca.md)

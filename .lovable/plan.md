## Objetivo

Notificar o site institucional via webhook outbound sempre que um lead WhatsApp for confirmado pelo `tracking-claim` (claim por `ref` OU por `phone_fallback`).

## Decisões

- **URL**: hardcoded → `https://koponuzfswxpmntcwgkc.supabase.co/functions/v1/crm-whatsapp-confirmed`
- **Secret**: apenas `EXTERNAL_APP_WEBHOOK_SECRET` (Bearer)
- **Quando disparar**: `manual` ❌ · `tracking` ✅ · `phone_fallback` ✅ · `not_found` ❌
- **Backoff**: 1min → 5min → 30min, parando após 24h (`status='dead'`)
- **Idempotência**: única entrega por `lead_id`

## Mudanças

### 1. Migration: `external_webhook_deliveries`

```text
id uuid pk
clinic_id uuid not null
lead_id uuid not null
endpoint text not null
payload jsonb not null
status text default 'pending'  -- pending | sent | failed | dead
attempts int default 0
next_attempt_at timestamptz default now()
last_status_code int
last_error text
last_attempt_at timestamptz
sent_at timestamptz
created_at, updated_at
UNIQUE (lead_id, endpoint)
INDEX (status, next_attempt_at)
```

RLS habilitado, sem políticas (acesso só via service role).

### 2. Secret

Solicitar `EXTERNAL_APP_WEBHOOK_SECRET` via add_secret antes de codar.

### 3. `tracking-claim/index.ts`

Após `update` bem-sucedido (ramos `tracking` e `phone_fallback`), antes do `return`:
- Buscar `lead.name`, `lead.phone`, e a 1ª mensagem inbound (texto + timestamp).
- Determinar `ref`: o extraído da msg, ou — se veio via `phone_fallback` sem ref na msg — o `ref_short` da `tracking_session` casada.
- `INSERT ... ON CONFLICT (lead_id, endpoint) DO NOTHING` em `external_webhook_deliveries` com payload completo.
- `EdgeRuntime.waitUntil(fetch(dispatcherUrl, { id }))` para tentativa imediata sem bloquear resposta.

### 4. Nova função `external-webhook-dispatcher`

`verify_jwt = false`. Dois modos:
- **Body `{id}`**: processa apenas aquele delivery (chamado pelo `tracking-claim`).
- **Sem body / body vazio**: pega lote de até 50 com `status='pending'` E `next_attempt_at <= now()` (chamado pelo cron).

Para cada entry:
1. POST `endpoint` com `Authorization: Bearer ${EXTERNAL_APP_WEBHOOK_SECRET}` + `Content-Type: application/json`, timeout 10s.
2. **2xx** → `status='sent'`, `sent_at=now()`.
3. **Outros / timeout** → `attempts++`, `last_status_code`, `last_error`, `last_attempt_at`. Próximo `next_attempt_at`:
   - tentativa 1 falhou → +1min
   - tentativa 2 falhou → +5min
   - tentativa 3 falhou → +30min
   - tentativa 4+ falhou → repete +30min até `created_at + 24h`; depois disso → `status='dead'`.

### 5. Cron (insert tool, não migration)

Habilitar `pg_cron` + `pg_net` se necessário e agendar:

```sql
select cron.schedule(
  'external-webhook-dispatcher-tick',
  '* * * * *',
  $$ select net.http_post(
       url:='https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/external-webhook-dispatcher',
       headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body:='{}'::jsonb
     ); $$
);
```

### 6. Payload enviado

```json
{
  "ref": "<10-char ref_short>",
  "phone": "+55...",          // lead.phone (E.164 se possível)
  "name": "...",              // lead.name
  "first_message": "...",     // 1ª msg inbound text
  "occurred_at": "<ISO>",     // timestamp da 1ª msg ou now()
  "crm_lead_id": "<uuid>"     // lead.id
}
```

### 7. `supabase/config.toml`

Adicionar bloco `[functions.external-webhook-dispatcher] verify_jwt = false`.

### 8. `docs/EDGE_FUNCTIONS.md`

Adicionar entry curta para a nova função e mencionar o disparo no `tracking-claim`.

## Ordem de execução

1. Solicitar secret `EXTERNAL_APP_WEBHOOK_SECRET`.
2. Migration (tabela).
3. Função `external-webhook-dispatcher` + edit `tracking-claim` + `config.toml` + docs.
4. Insert tool: cron schedule.
5. Smoke test via curl_edge_functions.

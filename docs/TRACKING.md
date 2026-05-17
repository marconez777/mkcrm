# Rastreio de origem — Site ↔ CRM

Documento para validar end-to-end o fluxo de atribuição de leads vindos do site
da clínica até o CRM (este projeto).

> **Projetos envolvidos**
> - **CRM** (este): `hrbhmqckzjxjbhpzpqeo` — recebe webhook do WhatsApp (Evolution), cria lead, dispara `tracking-claim`.
> - **Site** (outro): `koponuzfswxpmntcwgkc` — hospeda `tracking-pixel`, `tracking-ingest`, `tracking_sessions`, `tracking_events` e `crm-whatsapp-confirmed`.

---

## 1. Visão geral do fluxo

```
[Visitante no site clinicaohrpsiquiatria.com]
      │
      │ (1) Carrega <script src=".../tracking-pixel?t=TOKEN"> do projeto SITE
      ▼
[tracking-pixel.js no browser]
      │ (2) Cria sessionId, salva em localStorage (mk_sid)
      │ (3) POST /tracking-ingest  (pageview, wa_click, custom)
      │     → projeto SITE  (HTTPS obrigatório)
      │ (4) Reescreve links wa.me adicionando "(ref=XXXXXXXXXX)" no texto
      ▼
[Visitante clica no botão WhatsApp]
      │
      ▼
[WhatsApp / Evolution → webhook do CRM]
      │ (5) evolution-webhook cria lead, salva 1ª mensagem com "(ref=XXXX)"
      │ (6) Dispara tracking-claim({ lead_id })
      ▼
[tracking-claim no CRM]
      │ (7) Extrai ref da 1ª mensagem inbound
      │ (8) Busca tracking_sessions LOCAL  → não acha (sessão está no SITE)
      │ (9) Mesmo assim enfileira external_webhook_deliveries
      │     → POST https://<SITE>/functions/v1/crm-whatsapp-confirmed
      ▼
[crm-whatsapp-confirmed no SITE]
      │ (10) Acha tracking_sessions pelo ref_short
      │ (11) Marca sessão como convertida / cria registro no SITE
      │ (12) (opcional) responde com origin → CRM grava origin_source
```

---

## 2. Checklist por componente

### 2.1 Pixel (`tracking-pixel`, projeto SITE)

- [x] `INGEST` sempre montado a partir de `SUPABASE_URL` (https forçado).
- [x] `wa_click` usa `navigator.sendBeacon` (sobrevive à navegação).
- [x] `fetch` fallback com `keepalive: true, mode: 'cors', credentials: 'omit'`.
- [x] `console.warn` em caso de falha.
- [x] Reescreve `a[href*="wa.me"]` e `a[href*="api.whatsapp.com"]` com `(ref=…)`.
- [x] MutationObserver re-aplica a reescrita em SPAs.

**Como validar no browser:**
1. Abrir `https://clinicaohrpsiquiatria.com` com DevTools → Network.
2. Confirmar `GET …/tracking-pixel?t=…` → 200, `Content-Type: application/javascript`.
3. Confirmar `POST …/tracking-ingest` → 200 logo após carregar a página.
4. Passar o mouse num botão de WhatsApp → o `href` deve conter `text=…(ref=XXXXXXXXXX)`.
5. Clicar → novo `POST /tracking-ingest` com `type: wa_click`.

### 2.2 Webhook do WhatsApp (`evolution-webhook`, CRM)

- [x] Cria lead a partir da 1ª mensagem inbound.
- [x] Persiste o conteúdo bruto (inclusive `(ref=XXXX)`) em `messages`.
- [x] Chama `tracking-claim` com `{ lead_id }`.

### 2.3 Claim (`tracking-claim`, CRM)

- [x] Extrai `ref` via regex `\bref[=:]\s*([A-Za-z0-9]{6,32})`.
- [x] Busca local em `tracking_sessions` (caso o site também grave aqui — não é o caso atual).
- [x] **Mesmo sem sessão local**, enfileira `external_webhook_deliveries` → `crm-whatsapp-confirmed` no SITE.
- [x] Idempotente: se `lead.tracking_session_id` já existe, retorna `{ ok: true, already: true }`.
- [x] Dispatcher imediato via `EdgeRuntime.waitUntil(fetch(...))`.

### 2.4 Dispatcher (`external-webhook-dispatcher`, CRM)

- [x] Retry com backoff em caso de 5xx/timeout.
- [x] Marca `status = 'delivered' | 'failed'` em `external_webhook_deliveries`.

### 2.5 Confirmação (`crm-whatsapp-confirmed`, SITE)

- [x] Recebe `{ ref, phone_e164, name, first_message, occurred_at, crm_external_id }`.
- [x] Casa `ref` com `tracking_sessions.ref_short`.
- [x] Marca a sessão como convertida.

---

## 3. Como testar ponta a ponta (manual)

1. **Site (anônimo / aba anônima):**
   - Acessar `https://clinicaohrpsiquiatria.com/quanto-custa-um-tratamento-com-cetamina`.
   - DevTools → Network → confirmar `POST /tracking-ingest` 200.
   - Anotar `sessionId` em `localStorage.mk_sid` (os 10 primeiros chars sem `-` = `ref_short`).
2. **WhatsApp:**
   - Clicar no botão WhatsApp da página.
   - Enviar a mensagem padrão (deve conter `(ref=XXXXXXXXXX)`).
3. **CRM:**
   - Inbox: o lead deve aparecer em segundos.
   - Aba **Origem & Navegação** do lead: `origin_source` preenchido (ex.: `google_organic`).
   - `origin_confidence` = `tracking` (ou `external_ref` quando o ref veio via webhook externo).
4. **Logs (em caso de dúvida):**
   - `tracking-pixel`, `tracking-ingest` → projeto SITE.
   - `evolution-webhook`, `tracking-claim`, `external-webhook-dispatcher` → projeto CRM.

---

## 4. Pontos de falha comuns

| Sintoma | Causa provável | Onde olhar |
|---|---|---|
| `POST /tracking-ingest` bloqueado (Mixed Content) | Pixel servindo URL `http://` | `tracking-pixel/index.ts` → `INGEST` deve ser `https://` |
| Lead criado mas sem `origin_source` | Ref não veio na 1ª mensagem | `messages.content` da 1ª inbound |
| Ref presente mas sem atribuição | Sessão existe só no SITE; claim não enfileirou | `external_webhook_deliveries` no CRM (`status`, `error`) |
| `crm-whatsapp-confirmed` retorna 404 ref | `ref_short` não bate / TTL expirado | `tracking_sessions` no SITE |
| Pixel não carrega | `t=TOKEN` inválido / site não cadastrado em `tracking_sites` | Settings → Rastreamento de origem |

---

## 5. Estado atual

✅ Pixel servindo HTTPS, com `sendBeacon` para `wa_click`.
✅ `tracking-claim` enfileira `crm-whatsapp-confirmed` mesmo quando a sessão não existe localmente.
✅ Webhook externo idempotente (marca `origin_confidence = 'external_ref'`).
✅ Snippet visível em **Settings → Rastreamento de origem** (`TrackingSitesPanel`).

Nada pendente do lado do CRM. Próxima verificação: confirmar no Network do site
em produção que `POST /tracking-ingest` está retornando 200 após o deploy do
pixel corrigido.

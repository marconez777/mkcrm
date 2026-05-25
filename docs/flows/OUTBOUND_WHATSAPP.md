# Fluxo: WhatsApp Outbound (mensagem enviada)

> **Quando ler:** antes de mexer em envio manual, envio por agente IA, ou envio em massa (broadcast).
> **Última atualização:** 2026-05-25

---

## Atores

- **Frontend** Inbox (envio manual) **ou** `ai-auto-reply` / `broadcast-tick` / `sequence-tick` (envio automatizado)
- **Edge function** `evolution-send` (texto) / `evolution-send-media` (mídia)
- **Evolution API**
- **Postgres**: `wa_messages`, `lead_events`

---

## Sequência (envio manual via Inbox)

```text
Usuário digita e clica enviar
        │
        ▼
Frontend (useSendMessage hook)
        │ supabase.functions.invoke('evolution-send', { lead_id, text })
        ▼
evolution-send
        │ 1) verifica RLS via JWT (clinic do user = clinic do lead)
        │ 2) busca instance do clinic em clinic_settings
        │ 3) POST Evolution API /message/sendText
        │ 4) INSERT wa_messages (direction='out', status='sent')
        │ 5) INSERT lead_events ('message_out')
        ▼
Realtime ──▶ Inbox mostra mensagem com ✓
        │
        ▼
(depois) Evolution dispara webhook 'messages.update' com ack 2/3
        │
        ▼
evolution-webhook → UPDATE wa_messages.status = 'delivered'|'read'
```

---

## Sequência (envio automatizado)

```text
broadcast-tick / sequence-tick / ai-auto-reply
        │
        │ chama evolution-send via fetch interno (service_role)
        ▼
evolution-send  (mesma lógica, sem JWT — autorizado por SERVICE_ROLE_KEY)
```

---

## Status de uma mensagem outbound

| Status | Origem |
|---|---|
| `queued` | inserida antes de chamar Evolution (broadcasts) |
| `sent` | Evolution retornou 200 |
| `delivered` | webhook ack=2 |
| `read` | webhook ack=3 |
| `failed` | Evolution retornou erro OU timeout |

`failed` dispara `lead_events('message_failed')` com `error_code`. Broadcasts contam para `failed_count`.

---

## Pegadinhas

- **Rate limit do Evolution**: ~1 msg/s por instância. Broadcasts respeitam isso via jitter (ver `features/BROADCASTS.md`). Envios manuais não — usuário pode estourar se colar texto longo em N leads rapidamente. Hoje não há throttle no frontend.
- **Instância desconectada**: `evolution-send` retorna `instance_not_connected`. Frontend mostra toast e marca `clinic_settings.wa_status='disconnected'`. Job `evolution-health` confere a cada 5min.
- **Áudio enviado pelo agente IA**: precisa ser convertido para `ogg/opus` antes (Evolution rejeita mp3). Hoje só texto é gerado pela IA.
- **Mensagem fora do horário comercial**: broadcasts e sequences respeitam `business_hours`; envio manual **não** (intencional).
- **Variáveis de template** (`{{nome}}`): resolvidas no chamador (`broadcast-tick` faz replace antes de chamar `evolution-send`). `evolution-send` é "burro" — não interpola.
- **Mídia grande**: limite 16MB (Evolution). Validar antes de upload.

---

## Melhorias sugeridas

- Reagrupar `evolution-send` + `evolution-send-media` numa única função com discriminador `type`.
- Retry automático em `failed` com backoff (hoje quem chama decide).
- Métrica: tempo médio `sent → delivered`.

---

## Arquivos-chave

- `supabase/functions/evolution-send/index.ts`
- `supabase/functions/evolution-send-media/index.ts`
- `supabase/functions/evolution-webhook/index.ts` (ack handling)
- `src/hooks/useSendMessage.ts`
- `edge-functions/WHATSAPP.md`

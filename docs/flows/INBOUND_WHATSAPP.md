# Fluxo: WhatsApp Inbound (mensagem recebida)

> **Quando ler:** antes de mexer em qualquer parte do recebimento de mensagens (webhook Evolution, criação de leads, auto-reply).
> **Última atualização:** 2026-05-25

---

## Atores

- **Evolution API** (servidor externo, uma instância por clínica)
- **Edge function** `evolution-webhook` (entrypoint)
- **Postgres**: `wa_messages`, `leads`, `lead_events`, `clinic_settings`
- **Edge function** `ai-auto-reply` (opcional, async via `pg_net`)
- **Frontend** Inbox (subscribe via Realtime)

---

## Sequência

```text
WhatsApp do paciente
        │
        ▼
[Evolution API] ── POST webhook ──▶ evolution-webhook
                                          │
                                          │ 1) valida apikey + identifica clinic
                                          │ 2) normaliza phone (normalizePhoneBR)
                                          │ 3) upsert lead (find-by-phone | insert)
                                          │ 4) insert wa_messages (direction='in')
                                          │ 5) insert lead_events ('message_in')
                                          │ 6) update leads.last_inbound_at
                                          │
                                          ├──▶ pg_net.post → ai-auto-reply (se habilitado)
                                          │
                                          └──▶ Realtime broadcast
                                                    │
                                                    ▼
                                          Frontend Inbox atualiza badge / lista
```

---

## Passo a passo detalhado

### 1. Evolution → `evolution-webhook`

- Evolution dispara `POST` para a URL configurada no provisionamento (`evolution-provision`).
- Header `apikey` identifica a instância → `clinic_id`.
- Eventos relevantes: `messages.upsert`, `connection.update`, `qr.updated`.

Fonte: `supabase/functions/evolution-webhook/index.ts`.

### 2. Identificação do lead

- `phone = normalizePhoneBR(remoteJid)` (remove `@s.whatsapp.net`, força `+55`).
- `SELECT id FROM leads WHERE clinic_id=$1 AND phone=$2`.
- Se não existe → `INSERT leads (...)`  com `source='whatsapp'`, `stage_id=` primeiro stage do funil padrão.
- Trigger `tg_lead_after_insert` cria `lead_events` e enfileira sequências `on_lead_create`.

### 3. Persistência da mensagem

- `INSERT INTO wa_messages (clinic_id, lead_id, direction='in', body, media_url, evolution_message_id, ...)`.
- `evolution_message_id` é **UNIQUE** por clínica → idempotência (reentregas do Evolution).
- Se for mídia, `media_url` aponta para Storage (`wa-media` bucket) após download assíncrono.

### 4. Auto-reply (se habilitado)

- Lê `clinic_settings.ai_auto_reply_enabled` e horário comercial.
- `pg_net.post('/ai-auto-reply', body={ lead_id, clinic_id })` — **fire-and-forget**.
- `ai-auto-reply` roda o loop do agente (ver `flows/AI_AGENT_LOOP.md`) e usa `evolution-send` para responder.

### 5. Realtime para o frontend

- Tabelas `wa_messages` e `leads` estão na publication `supabase_realtime`.
- `useRealtimeList('wa_messages', { lead_id })` no Inbox recebe o `INSERT`.
- Badge de "não lidas" usa `leads.unread_count` (incrementado por trigger).

---

## Pegadinhas

- **Reentrega do Evolution**: sempre usar `evolution_message_id` UNIQUE — sem isso a mesma mensagem aparece N vezes.
- **Grupo do WhatsApp**: `remoteJid` termina em `@g.us` → ignoramos (não criamos lead).
- **fromMe=true**: mensagem enviada pelo próprio número da clínica via celular físico → `direction='out'`, lead opcional (criar se phone novo).
- **Áudio/imagem**: o webhook traz só metadata; o download da mídia é feito por `fetch-wa-avatar` / `evolution-send-media` (jobs separados). Até o download terminar, `media_url` é null.
- **Telefone sem DDD**: usuários antigos podem ter telefone fora do padrão. `normalizePhoneBR` tenta corrigir; quando falha, marca `lead.phone_invalid=true` e **não** dispara auto-reply.
- **Auto-reply fora do horário**: `clinic_settings.business_hours` define janela. Fora dela, registramos `lead_events('auto_reply_skipped_offhours')` mas não enviamos.

---

## Melhorias sugeridas

- Validar HMAC do Evolution (hoje só `apikey`).
- Mover download de mídia para fila dedicada com retry exponencial.
- Métricas: latência webhook→insert, taxa de duplicatas evitadas, % auto-replies bem-sucedidas.

---

## Arquivos-chave

- `supabase/functions/evolution-webhook/index.ts`
- `supabase/functions/_shared/phone.ts` (normalizePhoneBR)
- `supabase/functions/ai-auto-reply/index.ts`
- `database/SCHEMA.md` (wa_messages, leads, lead_events)
- `edge-functions/WHATSAPP.md`

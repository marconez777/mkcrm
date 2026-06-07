---
title: "Fluxo: WhatsApp Inbound (mensagem recebida)"
topic: inbox
kind: flow
audience: agent
updated: 2026-06-07
summary: "Fonte: `supabase/functions/evolution-webhook/index.ts`."
---
# Fluxo: WhatsApp Inbound (mensagem recebida)

> **Quando ler:** antes de mexer em qualquer parte do recebimento de mensagens (webhook Evolution, criação de leads, auto-reply).
> **Última atualização:** 2026-06-03

---

## Atores

- **Evolution API** (servidor externo, uma instância por clínica)
- **Edge function** `evolution-webhook` (entrypoint, **público** sem JWT — autentica pela URL `?token=` por instância)
- **Postgres**: `messages`, `leads`, `lead_events`, `whatsapp_instances`, `clinics.settings`
- **Edge function** `ai-auto-reply` (opcional, async via `pg_net`)
- **Frontend** Inbox (subscribe via Realtime)

> Não existe tabela `wa_messages` — toda mensagem (WA inbound/outbound, email, system) vive em `public.messages` com `channel='whatsapp'` e `direction='in'|'out'`.

---

## Sequência

```text
WhatsApp do paciente
        │
        ▼
[Evolution API] ── POST webhook ──▶ evolution-webhook
                                          │
                                          │ 1) resolve instância pelo token na URL
                                          │ 2) normaliza phone (normalizePhoneBR)
                                          │ 3) upsert lead (find-by-clinic+phone | insert)
                                          │ 4) insert messages(channel='whatsapp', direction='in', external_id)
                                          │ 5) insert lead_events('message_received')
                                          │ 6) trigger DB atualiza leads.last_message_at /
                                          │    last_message_preview / unread_count
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

- Evolution dispara `POST` para a URL configurada no provisionamento (`evolution-provision`), incluindo um `?token=` por instância.
- A função é pública (sem JWT) e resolve `whatsapp_instances` pelo token.
- Eventos relevantes: `messages.upsert`, `connection.update`, `qr.updated`.

Fonte: `supabase/functions/evolution-webhook/index.ts`.

### 2. Identificação do lead

- `phone = normalizePhoneBR(remoteJid)` (remove `@s.whatsapp.net`, força `55` quando aplicável).
- `SELECT id FROM leads WHERE clinic_id=$1 AND phone=$2`.
- Sem match → `INSERT leads (...)` com `source='whatsapp'`, `stage_id` resolvido pelo pipeline padrão da clínica e `whatsapp_instance_id` setado na instância que recebeu.
- Triggers DB sobre `leads` criam `lead_events` e podem disparar enrollments de sequências configuradas com `trigger_type='pipeline_enter'` (ver `features/SEQUENCES_AUTOMATIONS.md §1.2`).

### 3. Persistência da mensagem

- `INSERT INTO messages (clinic_id, lead_id, channel='whatsapp', direction='in', body, media_url, external_id, ...)`.
- `external_id` (id da mensagem na Evolution) é **UNIQUE por clínica** → idempotência (reentregas do Evolution caem em conflito e são absorvidas).
- Se for mídia, `media_url` é resolvida via `media-url.ts` (storage bucket `wa-media`).

### 4. Auto-reply (se habilitado)

- Lê `clinics.settings.ai.auto_reply_enabled` e horário comercial em `clinics.settings.business_hours`.
- Respeita `leads.ai_paused` — se `true`, não dispara (handoff manual).
- Respeita anti-loop por agente: se a última mensagem outbound foi de outro agente da mesma clínica (`messages.bot_agent_id`), o tick não responde.
- `pg_net.post('/ai-auto-reply', body={ lead_id, clinic_id })` — **fire-and-forget**.
- `ai-auto-reply` → `ai-chat` roda o loop do agente (ver `flows/AI_AGENT_LOOP.md`) e usa `evolution-send` para responder.

### 5. Realtime para o frontend

- Tabelas `messages` e `leads` estão na publication `supabase_realtime`.
- Inbox assina `postgres_changes` em `messages` filtrado por `lead_id`.
- Badge de "não lidas" usa `leads.unread_count` (mantido por trigger DB).

---

## Pegadinhas

- **Reentrega do Evolution**: idempotência via `messages.external_id` UNIQUE. Sem isso a mesma mensagem aparece N vezes.
- **Grupo do WhatsApp**: `remoteJid` termina em `@g.us` → ignorado (não cria lead).
- **`fromMe=true`**: mensagem enviada pelo próprio número da clínica via celular físico → `direction='out'` (também ingerida — útil para histórico).
- **Áudio/imagem**: o webhook traz só metadata + URL temporária; o download persistente é feito sob demanda por `media-url.ts` quando o frontend pede.
- **Telefone sem DDD**: `normalizePhoneBR` retorna `null` para strings inválidas — a mensagem ainda é gravada (lead com `phone` cru), mas auto-reply pode não casar.
- **Auto-reply fora do horário**: `clinics.settings.business_hours` define janela; fora dela o `ai-auto-reply` pula sem responder (não há `lead_events('auto_reply_skipped_offhours')` hoje — apenas log na função).
- **Spend guard**: se `ai_spend_limits.monthly_cap_usd` da clínica estiver estourado, `ai-chat` retorna 402 e `ai-auto-reply` apenas loga (sem mensagem ao lead).

---

## Melhorias sugeridas

- Validar HMAC do Evolution (hoje só o token na URL).
- Fila dedicada para download de mídia com retry exponencial.
- Métricas: latência webhook→insert, taxa de duplicatas evitadas, % auto-replies bem-sucedidas.
- Transcrição de áudio inbound (Whisper) — hoje o agente responde "ainda não escuto áudios".

---

## Arquivos-chave

- `supabase/functions/evolution-webhook/index.ts`
- `supabase/functions/_shared/evolution.ts` (`normalizePhoneBR`, `ingestMessage`)
- `supabase/functions/ai-auto-reply/index.ts`
- `database/SCHEMA.md` (`messages`, `leads`, `lead_events`)
- `edge-functions/WHATSAPP.md`

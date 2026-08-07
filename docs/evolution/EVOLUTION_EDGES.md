---
title: "Mapa â€” Evolution API (edges + shared)"
topic: integracao
kind: map
audience: agent
updated: 2026-07-01
summary: "Camada de integraÃ§Ã£o com Evolution API (Baileys) â€” 16 edges evolution-* + supabase/functions/_shared/evolution.ts (534 LOC). Provisiona, monitora, envia, ingesta e mantÃ©m instÃ¢ncias WhatsApp sincronizadas com messages/leads."
code_refs:
  - supabase/functions/_shared/evolution.ts
  - supabase/functions/evolution-provision/
  - supabase/functions/evolution-qr/
  - supabase/functions/evolution-webhook/
  - supabase/functions/evolution-health/
  - supabase/functions/evolution-send/
  - supabase/functions/evolution-send-media/
  - supabase/functions/evolution-sync-lead/
  - supabase/functions/evolution-collect-leads/
  - supabase/functions/evolution-backfill-all/
  - supabase/functions/evolution-delete-instance/
  - supabase/functions/evolution-delete-lead/
  - supabase/functions/evolution-delete-message/
  - supabase/functions/evolution-fetch-groups/
  - supabase/functions/evolution-logout/
  - supabase/functions/evolution-restart/
  - supabase/functions/evolution-test/
  - supabase/functions/fetch-wa-avatar/
  - supabase/functions/wa-redirect/
related_docs:
  - docs/evolution/WHATSAPP.md
  - docs/maps/INBOX_KANBAN_LEADS.md
  - docs/maps/PIPELINE_RUNTIME.md
---

# Evolution API â€” Mapa tÃ©cnico

Camada de integraÃ§Ã£o com o servidor **Evolution API** (Baileys). Toda comunicaÃ§Ã£o com o WhatsApp passa por aqui: envio, recepÃ§Ã£o via webhook, health e provisionamento.

## 1. Shared lib â€” `_shared/evolution.ts` (534 LOC)

NÃºcleo compartilhado por 16+ edges.

### Helpers de infra
- `corsHeaders`, `json(body,status)` â€” respostas padrÃ£o CORS.
- `sb()` â€” client service-role (bypassa RLS).
- `requireUser(req)` â€” valida JWT do Authorization; aceita service-role.

### InstÃ¢ncias
- `type Instance` â€” shape completo da linha `whatsapp_instances` usada pelas edges.
- `loadInstance(id?)` â€” busca por id, ou fallback `is_default = true`.
- `loadDefaultInstanceForClinic(clinicId)` â€” default da clÃ­nica â†’ fallback `connection_state=open`.
- `loadInstanceByToken(token)` â€” resolve instÃ¢ncia pelo `webhook_token` (usado por `evolution-webhook`).
- `loadAllInstances()` â€” usado pelo watchdog.

### Chamadas HTTP
- `evoBase(url)` â€” normaliza trailing slash.
- `evoFetch(instance, path, init)` â€” wrapper `fetch` com header `apikey: instance.evolution_api_key`.

### Parsers de payload
- `phoneFromKey(key)` â€” resolve telefone real do WhatsApp MD, tratando `addressingMode="lid"` (LID â†’ precisa `remoteJidAlt` senÃ£o descarta).
- `phoneFromJid(jid)` â€” deprecado, sem tratamento LID.
- `phoneFromContact(item)` â€” para eventos `CONTACTS_UPSERT`.
- `extractText(msg)` â€” normaliza para `{ type, content, mime?, fileName? }` cobrindo `conversation`, `extendedTextMessage`, `imageMessage`, `videoMessage`, `audioMessage`, `documentMessage`, `stickerMessage`.

### MÃ­dia
- Bucket: `chat-attachments`.
- `isMediaType(t)` â€” `image|video|audio|document|sticker`.
- `extFromMime(mime)` â€” mapa fixo de mime â†’ extensÃ£o.
- `downloadAndStoreMedia(messageId, instance, item)` â€” chama `/chat/getBase64FromMediaMessage`, faz `atob`, upload no bucket, cria signed URL de 7 dias e atualiza `messages.media_url/media_mime`. URLs em `imageMessage.url` etc sÃ£o criptografadas â€” **nunca baixar direto**.

### IngestÃ£o â€” `ingestMessage(item, source, { instanceId, silent })`
FunÃ§Ã£o central chamada pelo webhook, poll do health e sync manual. Passos:
1. Extrai telefone via `phoneFromKey`. Sem telefone â†’ skip.
2. Resolve `clinic_id` pela instÃ¢ncia (ou default da clÃ­nica).
3. Checa `deleted_leads`: se mensagem for anterior ao `deleted_at`, ignora (evita ressuscitar lead deletado).
4. Busca lead por `(phone, clinic_id)`. Se nÃ£o existe:
   - Escolhe pipeline: primeiro `pipelines.kind='sales' AND whatsapp_instance_id=instanceId`; fallback `is_default â†’ position â†’ created_at`.
   - Registra `lead_events.type='pipeline_fallback_used'` quando cai no fallback.
   - Insere com primeira stage (`pipeline_stages.position ASC`). Defesa contra race: se der `23505`, re-busca.
5. Se lead existia sem `whatsapp_instance_id` ou `name`, patch idempotente. `pushName` sÃ³ Ã© usado quando `fromMe=false` (senÃ£o seria o nome do usuÃ¡rio do WA, nÃ£o do contato).
6. Upsert em `messages` por `(lead_id, external_id)`; update se `content/status/reply_to/message_type` mudaram, insert se novo.
7. Se nova mensagem inbound e nÃ£o silent, chama RPC `increment_unread`. Se outbound, apenas atualiza `last_message_*`.
8. Retorna `{ lead_id, needs_media, message_id, isNew, ... }` â†’ o webhook usa `needs_media` para chamar `downloadAndStoreMedia` em background.

### Eventos assinados (`REQUIRED_EVENTS`)
```
MESSAGES_UPSERT, MESSAGES_UPDATE, MESSAGES_SET,
MESSAGING_HISTORY_SET, CHATS_UPSERT, CHATS_SET,
CONTACTS_UPSERT, CONNECTION_UPDATE
```
`evolution-health` reconfigura o webhook automaticamente se algum desses eventos estiver faltando.

## 2. Edges (16)

### Ciclo de vida de instÃ¢ncia
| Edge | LOC | Papel |
|---|---|---|
| `evolution-provision` | 143 | Cria instÃ¢ncia no Evolution (Baileys, base64, webhook por token) e insere em `whatsapp_instances`. Marca `is_default=true` se for a primeira da clÃ­nica. Requer secrets `EVOLUTION_GLOBAL_URL/API_KEY`. Rollback com `DELETE /instance/delete` em falha de DB. |
| `evolution-qr` | 70 | Chama `/instance/connect/{name}` e retorna base64 do QR ou pairing code. |
| `evolution-restart` | 21 | `PUT /instance/restart/{name}`. |
| `evolution-logout` | 21 | `DELETE /instance/logout/{name}`. Escalonado pelo health apÃ³s 240min sem eventos. |
| `evolution-delete-instance` | 91 | Deleta no Evolution + remove `whatsapp_instances`. |
| `evolution-test` | 33 | Ping simples pra diagnÃ³stico. |

### Envio
| Edge | LOC | Papel |
|---|---|---|
| `evolution-send` | 147 | Envia texto via `/message/sendText`. IdempotÃªncia por `client_message_id`. Retries `[0, 2s, 5s]`. Cria/atualiza row em `messages`. Suporta `quoted`. |
| `evolution-send-media` | 149 | Upload + `/message/sendMedia`. |
| `evolution-sync-lead` | 198 | Full sync manual: fetch chats + messages recentes do WA e chama `ingestMessage` por item. |

### RecepÃ§Ã£o & manutenÃ§Ã£o
| Edge | LOC | Papel |
|---|---|---|
| `evolution-webhook` | 470 | Endpoint pÃºblico (`?token=`). Dedupe via `webhook_dedup`. Logs em `webhook_events`. Roteia por `eventType`. `MESSAGES_UPSERT` â†’ `ingestMessage` em paralelo + `downloadAndStoreMedia` background. Cobre `MESSAGES_UPDATE` (status), `CONNECTION_UPDATE` (atualiza `connection_state/last_qr`), `CONTACTS_UPSERT` (patch name/avatar). |
| `evolution-health` | 340 | Watchdog (cron 60s). Itera todas as instÃ¢ncias, chama `/instance/connectionState`, reconfigura webhook se `REQUIRED_EVENTS` divergir, faz poll de mensagens dos Ãºltimos 10min. Detecta "surdez" (open sem eventos) por `STALE_DETECT_MIN=30`, `DEAF_THRESHOLD_MIN=120` â†’ auto-restart com cooldown 20min, `AUTO_LOGOUT_THRESHOLD_MIN=240` â†’ auto-logout com cooldown 60min. |
| `evolution-backfill-all` | 145 | Backfill em massa de todas as instÃ¢ncias (admin). |
| `evolution-collect-leads` | 135 | Import inicial da lista de contatos. |

### UtilitÃ¡rios
| Edge | LOC | Papel |
|---|---|---|
| `evolution-fetch-groups` | 40 | Lista grupos (`@g.us`) da instÃ¢ncia. |
| `evolution-delete-lead` | 56 | Purga um lead + mensagens; grava em `deleted_leads`. |
| `evolution-delete-message` | 84 | Delete lÃ³gico + `/chat/deleteMessageForEveryone`. |
| `fetch-wa-avatar` | 41 | Baixa avatar por telefone. |
| `wa-redirect` | 131 | Deep link wa.me com tracking. |

## 3. Tabelas envolvidas

| Tabela | Papel |
|---|---|
| `whatsapp_instances` (29 col) | InstÃ¢ncias por clÃ­nica. Colunas sensÃ­veis (`evolution_api_key`, `webhook_token`) protegidas por **column-level security** â€” `authenticated` nÃ£o tem `SELECT` nesses campos. |
| `messages` (26 col) | Todas mensagens IN/OUT com `external_id`, `client_message_id`, `media_url`, `raw`. |
| `webhook_events` (9 col) | Audit trail bruto de eventos Evolution. |
| `webhook_dedup` (2 col) | Chave de dedupe por evento (`{event}::{instance}::{key}::{ts}`). |
| `error_events` (11 col) | Falhas de provisionamento/envio (surface=`evolution`). |
| `deleted_leads` | Bloqueia ingestÃ£o de mensagens antigas apÃ³s purga. |
| `leads` | Auto-criado quando telefone novo entra pelo webhook. |

## 4. Fluxo end-to-end

```text
Cliente escaneia QR (WhatsAppQrDialog)
  â†³ evolution-provision â†’ cria no Evolution + insere whatsapp_instances
  â†³ evolution-qr â†’ devolve base64
  â†³ webhook CONNECTION_UPDATE â†’ atualiza connection_state='open'

Mensagem inbound
  Evolution â†’ POST /functions/v1/evolution-webhook?token=<T>
  â†³ loadInstanceByToken â†’ dedupe â†’ webhook_events insert
  â†³ ingestMessage (paralelo por item)
     â†’ cria lead se novo, resolve pipeline, upsert message, unread++
  â†³ downloadAndStoreMedia (background) â†’ chat-attachments bucket

Envio outbound (Composer UI ou automaÃ§Ã£o)
  â†’ evolution-send / evolution-send-media
  â†’ idempotÃªncia por client_message_id
  â†’ row em messages com from_me=true, status='sent'
```

## 5. Invariantes

1. **Nunca baixar `imageMessage.url` diretamente** â€” URL Ã© criptografada; sempre `downloadAndStoreMedia`.
2. `pushName` sÃ³ Ã© aplicado quando `fromMe=false` (senÃ£o Ã© o nome do dono da conta).
3. `phoneFromKey` descarta LID sem `remoteJidAlt` â€” nÃ£o inventar telefone.
4. DeduplicaÃ§Ã£o de webhook Ã© **obrigatÃ³ria** â€” Evolution reenvia em ~30s em caso de timeout.
5. `is_default=true` deve existir para no mÃ¡ximo 1 instÃ¢ncia por clÃ­nica (usada como fallback em `loadInstance`).
6. `webhook_token` Ã© o Ãºnico mecanismo de auth do webhook (Ã© pÃºblico, entÃ£o trate como secret rotÃ¡vel).
7. `evolution-health` NÃƒO envia mensagens â€” sÃ³ monitora, poll e reconfigura webhook.
8. ApÃ³s `evolution-logout`, o cliente precisa reescanear o QR (auto-logout Ã© escalada final).
9. Mensagens com `timestamp <= deleted_leads.deleted_at` sÃ£o descartadas em `ingestMessage`.

## 6. DÃ©bitos tÃ©cnicos

- `evolution-webhook` (470 LOC) tem lÃ³gica extensa por tipo de evento â€” candidato a splitar em `handlers/`.
- `evolution-sync-lead` duplica parte da lÃ³gica do webhook.
- `evolution-backfill-all` nÃ£o tem cursor persistente â€” reinicia do zero em falha.
- Falta mÃ©trica agregada de latÃªncia p95 de `evoFetch` por clÃ­nica.

## 7. Secrets obrigatÃ³rios

- `EVOLUTION_GLOBAL_URL` â€” base do servidor Evolution (ex: `https://evo.chatfunnelai.com`).
- `EVOLUTION_GLOBAL_API_KEY` â€” chave global usada apenas em `evolution-provision`. InstÃ¢ncias individuais usam sua prÃ³pria `evolution_api_key` gerada no provision.

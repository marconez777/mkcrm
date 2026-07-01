---
title: "Mapa — Evolution API (edges + shared)"
topic: integracao
kind: map
audience: agent
updated: 2026-07-01
summary: "Camada de integração com Evolution API (Baileys) — 16 edges evolution-* + supabase/functions/_shared/evolution.ts (534 LOC). Provisiona, monitora, envia, ingesta e mantém instâncias WhatsApp sincronizadas com messages/leads."
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
  - docs/maps/WHATSAPP.md
  - docs/maps/INBOX_KANBAN_LEADS.md
  - docs/maps/PIPELINE_RUNTIME.md
---

# Evolution API — Mapa técnico

Camada de integração com o servidor **Evolution API** (Baileys). Toda comunicação com o WhatsApp passa por aqui: envio, recepção via webhook, health e provisionamento.

## 1. Shared lib — `_shared/evolution.ts` (534 LOC)

Núcleo compartilhado por 16+ edges.

### Helpers de infra
- `corsHeaders`, `json(body,status)` — respostas padrão CORS.
- `sb()` — client service-role (bypassa RLS).
- `requireUser(req)` — valida JWT do Authorization; aceita service-role.

### Instâncias
- `type Instance` — shape completo da linha `whatsapp_instances` usada pelas edges.
- `loadInstance(id?)` — busca por id, ou fallback `is_default = true`.
- `loadDefaultInstanceForClinic(clinicId)` — default da clínica → fallback `connection_state=open`.
- `loadInstanceByToken(token)` — resolve instância pelo `webhook_token` (usado por `evolution-webhook`).
- `loadAllInstances()` — usado pelo watchdog.

### Chamadas HTTP
- `evoBase(url)` — normaliza trailing slash.
- `evoFetch(instance, path, init)` — wrapper `fetch` com header `apikey: instance.evolution_api_key`.

### Parsers de payload
- `phoneFromKey(key)` — resolve telefone real do WhatsApp MD, tratando `addressingMode="lid"` (LID → precisa `remoteJidAlt` senão descarta).
- `phoneFromJid(jid)` — deprecado, sem tratamento LID.
- `phoneFromContact(item)` — para eventos `CONTACTS_UPSERT`.
- `extractText(msg)` — normaliza para `{ type, content, mime?, fileName? }` cobrindo `conversation`, `extendedTextMessage`, `imageMessage`, `videoMessage`, `audioMessage`, `documentMessage`, `stickerMessage`.

### Mídia
- Bucket: `chat-attachments`.
- `isMediaType(t)` — `image|video|audio|document|sticker`.
- `extFromMime(mime)` — mapa fixo de mime → extensão.
- `downloadAndStoreMedia(messageId, instance, item)` — chama `/chat/getBase64FromMediaMessage`, faz `atob`, upload no bucket, cria signed URL de 7 dias e atualiza `messages.media_url/media_mime`. URLs em `imageMessage.url` etc são criptografadas — **nunca baixar direto**.

### Ingestão — `ingestMessage(item, source, { instanceId, silent })`
Função central chamada pelo webhook, poll do health e sync manual. Passos:
1. Extrai telefone via `phoneFromKey`. Sem telefone → skip.
2. Resolve `clinic_id` pela instância (ou default da clínica).
3. Checa `deleted_leads`: se mensagem for anterior ao `deleted_at`, ignora (evita ressuscitar lead deletado).
4. Busca lead por `(phone, clinic_id)`. Se não existe:
   - Escolhe pipeline: primeiro `pipelines.kind='sales' AND whatsapp_instance_id=instanceId`; fallback `is_default → position → created_at`.
   - Registra `lead_events.type='pipeline_fallback_used'` quando cai no fallback.
   - Insere com primeira stage (`pipeline_stages.position ASC`). Defesa contra race: se der `23505`, re-busca.
5. Se lead existia sem `whatsapp_instance_id` ou `name`, patch idempotente. `pushName` só é usado quando `fromMe=false` (senão seria o nome do usuário do WA, não do contato).
6. Upsert em `messages` por `(lead_id, external_id)`; update se `content/status/reply_to/message_type` mudaram, insert se novo.
7. Se nova mensagem inbound e não silent, chama RPC `increment_unread`. Se outbound, apenas atualiza `last_message_*`.
8. Retorna `{ lead_id, needs_media, message_id, isNew, ... }` → o webhook usa `needs_media` para chamar `downloadAndStoreMedia` em background.

### Eventos assinados (`REQUIRED_EVENTS`)
```
MESSAGES_UPSERT, MESSAGES_UPDATE, MESSAGES_SET,
MESSAGING_HISTORY_SET, CHATS_UPSERT, CHATS_SET,
CONTACTS_UPSERT, CONNECTION_UPDATE
```
`evolution-health` reconfigura o webhook automaticamente se algum desses eventos estiver faltando.

## 2. Edges (16)

### Ciclo de vida de instância
| Edge | LOC | Papel |
|---|---|---|
| `evolution-provision` | 143 | Cria instância no Evolution (Baileys, base64, webhook por token) e insere em `whatsapp_instances`. Marca `is_default=true` se for a primeira da clínica. Requer secrets `EVOLUTION_GLOBAL_URL/API_KEY`. Rollback com `DELETE /instance/delete` em falha de DB. |
| `evolution-qr` | 70 | Chama `/instance/connect/{name}` e retorna base64 do QR ou pairing code. |
| `evolution-restart` | 21 | `PUT /instance/restart/{name}`. |
| `evolution-logout` | 21 | `DELETE /instance/logout/{name}`. Escalonado pelo health após 240min sem eventos. |
| `evolution-delete-instance` | 91 | Deleta no Evolution + remove `whatsapp_instances`. |
| `evolution-test` | 33 | Ping simples pra diagnóstico. |

### Envio
| Edge | LOC | Papel |
|---|---|---|
| `evolution-send` | 147 | Envia texto via `/message/sendText`. Idempotência por `client_message_id`. Retries `[0, 2s, 5s]`. Cria/atualiza row em `messages`. Suporta `quoted`. |
| `evolution-send-media` | 149 | Upload + `/message/sendMedia`. |
| `evolution-sync-lead` | 198 | Full sync manual: fetch chats + messages recentes do WA e chama `ingestMessage` por item. |

### Recepção & manutenção
| Edge | LOC | Papel |
|---|---|---|
| `evolution-webhook` | 470 | Endpoint público (`?token=`). Dedupe via `webhook_dedup`. Logs em `webhook_events`. Roteia por `eventType`. `MESSAGES_UPSERT` → `ingestMessage` em paralelo + `downloadAndStoreMedia` background. Cobre `MESSAGES_UPDATE` (status), `CONNECTION_UPDATE` (atualiza `connection_state/last_qr`), `CONTACTS_UPSERT` (patch name/avatar). |
| `evolution-health` | 340 | Watchdog (cron 60s). Itera todas as instâncias, chama `/instance/connectionState`, reconfigura webhook se `REQUIRED_EVENTS` divergir, faz poll de mensagens dos últimos 10min. Detecta "surdez" (open sem eventos) por `STALE_DETECT_MIN=30`, `DEAF_THRESHOLD_MIN=120` → auto-restart com cooldown 20min, `AUTO_LOGOUT_THRESHOLD_MIN=240` → auto-logout com cooldown 60min. |
| `evolution-backfill-all` | 145 | Backfill em massa de todas as instâncias (admin). |
| `evolution-collect-leads` | 135 | Import inicial da lista de contatos. |

### Utilitários
| Edge | LOC | Papel |
|---|---|---|
| `evolution-fetch-groups` | 40 | Lista grupos (`@g.us`) da instância. |
| `evolution-delete-lead` | 56 | Purga um lead + mensagens; grava em `deleted_leads`. |
| `evolution-delete-message` | 84 | Delete lógico + `/chat/deleteMessageForEveryone`. |
| `fetch-wa-avatar` | 41 | Baixa avatar por telefone. |
| `wa-redirect` | 131 | Deep link wa.me com tracking. |

## 3. Tabelas envolvidas

| Tabela | Papel |
|---|---|
| `whatsapp_instances` (29 col) | Instâncias por clínica. Colunas sensíveis (`evolution_api_key`, `webhook_token`) protegidas por **column-level security** — `authenticated` não tem `SELECT` nesses campos. |
| `messages` (26 col) | Todas mensagens IN/OUT com `external_id`, `client_message_id`, `media_url`, `raw`. |
| `webhook_events` (9 col) | Audit trail bruto de eventos Evolution. |
| `webhook_dedup` (2 col) | Chave de dedupe por evento (`{event}::{instance}::{key}::{ts}`). |
| `error_events` (11 col) | Falhas de provisionamento/envio (surface=`evolution`). |
| `deleted_leads` | Bloqueia ingestão de mensagens antigas após purga. |
| `leads` | Auto-criado quando telefone novo entra pelo webhook. |

## 4. Fluxo end-to-end

```text
Cliente escaneia QR (WhatsAppQrDialog)
  ↳ evolution-provision → cria no Evolution + insere whatsapp_instances
  ↳ evolution-qr → devolve base64
  ↳ webhook CONNECTION_UPDATE → atualiza connection_state='open'

Mensagem inbound
  Evolution → POST /functions/v1/evolution-webhook?token=<T>
  ↳ loadInstanceByToken → dedupe → webhook_events insert
  ↳ ingestMessage (paralelo por item)
     → cria lead se novo, resolve pipeline, upsert message, unread++
  ↳ downloadAndStoreMedia (background) → chat-attachments bucket

Envio outbound (Composer UI ou automação)
  → evolution-send / evolution-send-media
  → idempotência por client_message_id
  → row em messages com from_me=true, status='sent'
```

## 5. Invariantes

1. **Nunca baixar `imageMessage.url` diretamente** — URL é criptografada; sempre `downloadAndStoreMedia`.
2. `pushName` só é aplicado quando `fromMe=false` (senão é o nome do dono da conta).
3. `phoneFromKey` descarta LID sem `remoteJidAlt` — não inventar telefone.
4. Deduplicação de webhook é **obrigatória** — Evolution reenvia em ~30s em caso de timeout.
5. `is_default=true` deve existir para no máximo 1 instância por clínica (usada como fallback em `loadInstance`).
6. `webhook_token` é o único mecanismo de auth do webhook (é público, então trate como secret rotável).
7. `evolution-health` NÃO envia mensagens — só monitora, poll e reconfigura webhook.
8. Após `evolution-logout`, o cliente precisa reescanear o QR (auto-logout é escalada final).
9. Mensagens com `timestamp <= deleted_leads.deleted_at` são descartadas em `ingestMessage`.

## 6. Débitos técnicos

- `evolution-webhook` (470 LOC) tem lógica extensa por tipo de evento — candidato a splitar em `handlers/`.
- `evolution-sync-lead` duplica parte da lógica do webhook.
- `evolution-backfill-all` não tem cursor persistente — reinicia do zero em falha.
- Falta métrica agregada de latência p95 de `evoFetch` por clínica.

## 7. Secrets obrigatórios

- `EVOLUTION_GLOBAL_URL` — base do servidor Evolution (ex: `https://evo.chatfunnelai.com`).
- `EVOLUTION_GLOBAL_API_KEY` — chave global usada apenas em `evolution-provision`. Instâncias individuais usam sua própria `evolution_api_key` gerada no provision.

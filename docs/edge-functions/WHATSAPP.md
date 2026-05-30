# WHATSAPP — Edge functions Evolution API

> Última atualização: 2026-05-30
> Provider: **Evolution API** (https://github.com/EvolutionAPI/evolution-api), self-hosted.
> 19 funções: 16 prefixadas `evolution-*` + `fetch-wa-avatar`, `transcribe-audio`, `wa-redirect`.
> Helpers compartilhados em [`SHARED_HELPERS.md`](./SHARED_HELPERS.md) — toda função abaixo importa de `_shared/evolution.ts`.
> Fluxos end-to-end: `flows/INBOUND_WHATSAPP.md` e `flows/OUTBOUND_WHATSAPP.md`.

## Tabela-mapa

| Função | Trigger | Lê | Escreve | Auth |
|---|---|---|---|---|
| `evolution-webhook` | HTTP (Evolution → nós) | `whatsapp_instances` (by token) | `messages`, `leads`, `webhook_events`, `webhook_dedup`, `storage` | token na query |
| `evolution-send` | Frontend / IA | `whatsapp_instances`, `leads` | `messages` (status), Evolution `sendText` | JWT user |
| `evolution-send-media` | Frontend | `leads`, `whatsapp_instances` | `messages`, Evolution `sendMedia`/`sendWhatsAppAudio` | JWT user |
| `evolution-provision` | Frontend (admin) | – | `whatsapp_instances`, Evolution create instance | JWT admin |
| `evolution-qr` | Frontend | `whatsapp_instances` | – (chama Evolution) | público (mas só retorna se instância existir) |
| `evolution-logout` | Frontend | `whatsapp_instances` | – (Evolution `/logout`) | público |
| `evolution-restart` | Frontend | `whatsapp_instances` | – (Evolution `/restart`) | público |
| `evolution-delete-instance` | Frontend (admin) | `whatsapp_instances` | DELETE em `whatsapp_instances` + Evolution | JWT admin |
| `evolution-health` | `pg_cron` (60s) | `whatsapp_instances` (todas), Evolution `connectionState` | atualiza `status`, dispara restart, pollMissed via `ingestMessage` | service role |
| `evolution-test` | Frontend | `whatsapp_instances` | – | JWT user |
| `evolution-collect-leads` | Frontend (admin) | Evolution `findChats` | `leads`, `messages` via `ingestMessage` | JWT admin |
| `evolution-backfill-all` | Frontend (admin) | Evolution histórico | `leads`, `messages` | JWT admin |
| `evolution-delete-lead` | Frontend | `leads`, `messages` | DELETE, INSERT em `deleted_leads` | JWT user |
| `evolution-delete-message` | Frontend | `messages` | UPDATE soft-delete + Evolution `chat/deleteMessage` | JWT user |
| `evolution-sync-lead` | Frontend | Evolution `findChat/findMessages` | `leads`, `messages` | JWT user |
| `evolution-fetch-groups` | Frontend (Scheduled Reports) | Evolution `group/fetchAllGroups` | – (lista grupos WA) | JWT user |
| `fetch-wa-avatar` | Frontend / `evolution-webhook` | Evolution `fetchProfilePicture` | atualiza `leads.avatar_url` | service role |
| `transcribe-audio` | Frontend / `ai-auto-reply` | mensagem de áudio | retorna transcrição (não persiste) | JWT user |
| `wa-redirect` | URL público | `leads.phone` | – (302 para `https://wa.me/...`) | público |

---

## `evolution-webhook` ⭐ entrada principal

**URL pública**: `https://<project>.functions.supabase.co/evolution-webhook?token=<webhook_token>`

Configurada em cada `whatsapp_instances.webhook_token` (gerado em `evolution-provision`). Eventos exigidos pelo Evolution: ver `REQUIRED_EVENTS` em `_shared/evolution.ts` (`MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CHATS_*`, `CONTACTS_UPSERT`, `CONNECTION_UPDATE`, etc.).

### Fluxo

1. Lê `token` da query → `loadInstanceByToken`. 401 se inválido.
2. Lê body, calcula `eventType`.
3. INSERT em `webhook_events` (audit log).
4. Dedup por `eventType + message_id` (`isWebhookDuplicate`, TTL 5min) — evita re-ingest em reentregas.
5. Normaliza items (alguns eventos vêm como `{ messages: [...] }`).
6. Para cada item: `ingestMessage(item, "webhook", { instanceId })`.
7. `CONNECTION_UPDATE` → atualiza `whatsapp_instances.status`.
8. Atualiza `webhook_events.processed_at` + duração.
9. Retorna 200 sempre (Evolution retenta em 4xx/5xx).

**Pegadinhas:**
- Eventos de histórico (`MESSAGING_HISTORY_SET`) podem trazer 1000+ mensagens em uma chamada. Loop interno usa `pmap` com limite.
- `webhook_dedup` só funciona se o evento traz `message_id` único. Eventos de connection não dedupam.
- Status `failed` na Evolution não vira `failed` automaticamente em `messages` — depende de `MESSAGES_UPDATE` posterior.
- Não confunda `instance` (id interno na Evolution) com `whatsapp_instances.id` (nosso UUID).

---

## `evolution-send` & `evolution-send-media`

Envio outbound de texto / mídia. Padrão idêntico:

1. Valida JWT (`requireUser`).
2. Lê `{ lead_id, text, client_message_id?, quoted_external_id?, bot_agent_id? }` (ou `media_*`).
3. Carrega `leads.phone` + `whatsapp_instances` correspondente.
4. INSERT em `messages` com status `pending` (idempotente por `client_message_id`). Quando `bot_agent_id` é passado, é gravado em `messages.bot_agent_id` e funciona como **loop-guard** do `ai-auto-reply` (impede bot-↔-bot — ver `flows/AI_AGENT_LOOP.md`).
5. Tenta `evoFetch` até 3x com backoff `[0, 2000, 5000]ms`.
6. Em sucesso, atualiza `messages.status = 'sent'`, `external_id = wa_id`.
7. Em falha definitiva, status `failed` + `error`.

**Mídia**: `evolution-send-media` aceita `kind ∈ {image, video, audio, document}` e roteia para endpoint correto (`sendWhatsAppAudio` para áudio com formato PTT; `sendMedia` para demais).

**Pegadinhas:**
- `client_message_id` (UUID gerado no frontend) é a chave de idempotência principal. Sem ele, duplo-clique = duas mensagens.
- Evolution exige número no formato `5511999998888@s.whatsapp.net` para alguns endpoints. Helper interno normaliza.
- Mensagens > 4096 chars são rejeitadas pelo WhatsApp.
- `quoted_external_id` deve ser um `external_id` válido (id do WA), não nosso UUID.
- `bot_agent_id` em `messages` é a única forma de o watcher silencioso distinguir mensagem outbound de humano vs. mensagem outbound de bot (evita feedback loop).

---

## `evolution-provision` ⚙ admin

Cria nova instância na Evolution e registra em `whatsapp_instances`:

1. Recebe `{ clinic_id, name }`.
2. Slugifica nome → `evolution_instance`.
3. Gera `webhook_token` (uuid).
4. Chama Evolution `instance/create` com webhook configurado.
5. Subscreve eventos `REQUIRED_EVENTS`.
6. INSERT em `whatsapp_instances` com status `pending_qr`.

**Pegadinhas:**
- Nomes de instância são únicos GLOBAL na Evolution — colisão entre clínicas. Slug inclui hash da clínica para evitar.
- Se INSERT no nosso DB falha após criar na Evolution → instância "orfã" no Evolution. Limpar manualmente.

---

## `evolution-qr`, `evolution-logout`, `evolution-restart`, `evolution-delete-instance`, `evolution-test`

Wrappers finos sobre endpoints Evolution. Todos:
- Carregam instância via `loadInstance(instance_id)`.
- Chamam `evoFetch` com auth header (`apikey: instance.api_key`).
- Retornam `{ ok, ... }`.

`evolution-qr` é especial: primeiro checa `connectionState`. Se já `open`, retorna cedo. Caso contrário pede QR/pairing.

`evolution-delete-instance` requer admin (verifica `is_clinic_admin` via user client). DELETE em cascata em `whatsapp_instances` (FK ON DELETE SET NULL em `leads.whatsapp_instance_id`).

---

## `evolution-health` ⚙ watchdog (cron)

Roda a cada 60s via `pg_cron` → `invoke_edge_function('evolution-health')`.

Para CADA instância em `whatsapp_instances`:
1. Consulta `connectionState`.
2. Atualiza `status` local.
3. **Self-heal de webhook**: se a config no Evolution não está com `REQUIRED_EVENTS` ou URL errada → recadastra.
4. **Detecção de "surdez"**: se `state=open` mas sem mensagens novas há >`DEAF_THRESHOLD_MIN`(120 min) → restart automático (com cooldown de `AUTO_RESTART_COOLDOWN_MIN`=20 min).
5. **Poll de mensagens perdidas**: janela últimos `POLL_WINDOW_MIN`=10 min — chama `findMessages` e re-ingere via `ingestMessage(item, "poll")` (idempotente).

**Pegadinhas:**
- Detecção de surdez assume `last_message_at` confiável — qualquer write em `messages` reseta. Cuidado em ambientes sem tráfego.
- Cooldown não persiste entre deploys — em deploy hot, pode rodar restart duplicado.

---

## `evolution-collect-leads` & `evolution-backfill-all` ⚙ admin

Importa histórico:
- `collect-leads`: lista chats → cria/atualiza leads (sem importar mensagens).
- `backfill-all`: para cada chat, `findMessages(limit=N)` e re-ingere via `ingestMessage`.

São operações longas. Recomenda-se UI mostrar progresso via polling de tabela auxiliar.

---

## `evolution-delete-lead` & `evolution-delete-message`

- `delete-lead`: DELETE em `leads` (cascade). INSERT em `deleted_leads` para evitar re-criação por mensagens antigas (ver `ingestMessage`).
- `delete-message`: soft-delete em `messages` + Evolution `chat/deleteMessage` (only-me ou both).

---

## `evolution-sync-lead`

Sync sob demanda de UM lead: busca chat + mensagens recentes na Evolution e re-ingere. Útil quando webhook perdeu eventos.

---

## `fetch-wa-avatar`

Busca avatar do contato em `fetchProfilePicture` da Evolution. Atualiza `leads.avatar_url`. Chamado:
- Manual via UI.
- Automaticamente em `evolution-webhook` ao criar novo lead (background).

---

## `transcribe-audio`

Recebe `{ media_url }` (de uma mensagem áudio). Chama provider STT (Whisper / Lovable AI) e retorna `{ text }`. Não persiste — caller decide se grava em `messages.transcript`.

**Pegadinhas:**
- Áudios > 25MB falham no Whisper. Pré-validar tamanho.
- Não consome `spend-guard` ainda — TODO.

---

## `wa-redirect`

Endpoint público: `GET /wa-redirect?to=<phone>&utm_source=...` → 302 para `https://wa.me/<phone>?text=...`. Antes de redirecionar, registra evento em `tracking_events` para atribuição.

---

## Variáveis de ambiente usadas

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (todos)
- `LOVABLE_API_KEY` (somente `transcribe-audio` quando provider = gateway)
- Evolution API key e base URL ficam em `whatsapp_instances.api_key` / `.base_url` (por instância, não env).

## Pegadinhas globais do domínio

- **Sem RLS na escrita**: todas essas functions usam service_role. Validação tenant deve ser explícita (`requireUser` + checagem manual de `lead.clinic_id === user.clinic_id` quando aplicável). Hoje algumas confiam só na obscuridade — auditar.
- **Webhook URL muda quando troca de projeto Supabase**. `evolution-health` recadastra, mas se a Evolution ainda aponta para URL antiga, eventos somem. Solução: rerun `evolution-provision` ou `health`.
- **Instâncias suspensas**: Evolution suspende após inatividade. `evolution-health` detecta e reabilita.
- **Áudio `ptt`** (push-to-talk) vs áudio comum: Evolution usa endpoints diferentes; `evolution-send-media` decide pelo `mime`.
- **Mensagens "broadcast" do WA Business** chegam com `from_me=true` mesmo sem ter sido enviadas pelo nosso sistema → criam leads "fantasma" sem stage. Mitigar: filtrar em `ingestMessage` por presença de `client_message_id` ou metadata específica.

## Melhorias sugeridas (ver `roadmap/IMPROVEMENTS.md`)

- Migrar checagem de tenant em `evolution-delete-*` para policy-aware client (RLS em vez de service role + check manual).
- Padronizar formato de telefone (`E.164`) em insert único helper.
- Substituir `setTimeout` por fila persistente (`pg_cron` job) para retries de envio.
- Adicionar `spend-guard` em `transcribe-audio`.
- Mover Evolution API key para Supabase Vault (hoje fica em coluna texto).

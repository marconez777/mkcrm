# Integração: Evolution API (WhatsApp)

> **Quando ler:** antes de mexer em qualquer função `evolution-*`, provisionamento de instância, QR code, ou debug de mensagens não entregues.
> **Última atualização:** 2026-06-03

---

## O que é

Evolution API é um servidor open-source que faz ponte com o WhatsApp Web. Uma **instância** = uma sessão WhatsApp ativa (pareada via QR). No mkart, **1 clínica = 1 instância**.

- Endpoint base: definido em `EVOLUTION_BASE_URL` (env secret)
- Auth global: header `apikey: ${EVOLUTION_GLOBAL_API_KEY}` (cria/lista instâncias)
- Auth por instância: cada instância tem sua própria `apikey` (gerada pelo Evolution no create) — guardada em `whatsapp_instances.evolution_api_key` (e refletida em `clinics.settings.evolution.api_key`)

---

## Secrets (Lovable Cloud)

| Nome | Onde | Uso |
|---|---|---|
| `EVOLUTION_BASE_URL` | edge functions | URL do servidor Evolution |
| `EVOLUTION_GLOBAL_API_KEY` | edge functions | criar/listar instâncias |
| `EVOLUTION_WEBHOOK_TOKEN` | edge functions | header extra que o webhook valida |

Por instância (no banco, **`clinics.settings.evolution`** JSON — não existe tabela `clinic_settings`): `instance_name`, `api_key`, `status`, `phone`.

---

## Endpoints usados

| Edge function | Endpoint Evolution | Método |
|---|---|---|
| `evolution-provision` | `/instance/create` | POST |
| `evolution-qr` | `/instance/connect/{name}` | GET |
| `evolution-restart` | `/instance/restart/{name}` | POST |
| `evolution-logout` | `/instance/logout/{name}` | DELETE |
| `evolution-delete-instance` | `/instance/delete/{name}` | DELETE |
| `evolution-health` | `/instance/connectionState/{name}` | GET (cron 5min) |
| `evolution-send` | `/message/sendText/{name}` | POST |
| `evolution-send-media` | `/message/sendMedia/{name}` | POST |
| `evolution-collect-leads` | `/chat/findChats/{name}` | POST |
| `evolution-sync-lead` | `/chat/findMessages/{name}` | POST |
| `evolution-delete-message` | `/message/deleteMessage/{name}` | DELETE |
| `evolution-backfill-all` | múltiplos | — |
| `evolution-fetch-groups` | `/group/fetchAllGroups/{name}` | GET (usado por `scheduled-report-tick` para resolver destinos de relatórios em grupos) |
| `evolution-test` | `/instance/fetchInstances` | GET (smoke) |

---

## Webhook (eventos recebidos)

Configurado no `evolution-provision` apontando para `https://<project>.functions.supabase.co/evolution-webhook`.

Eventos relevantes:
- `messages.upsert` — mensagem nova (in/out)
- `messages.update` — ack (delivered/read)
- `connection.update` — pareou/desconectou
- `qr.updated` — QR refresh
- `contacts.upsert` — atualização de contato (avatar, nome)

O webhook é público e autentica via `?token=` na query string (validado contra `EVOLUTION_WEBHOOK_TOKEN`), não pelo header `apikey`. A instância é resolvida pelo nome no payload.

Ver `flows/INBOUND_WHATSAPP.md`.

---

## Lifecycle de uma instância

```text
1. clinic_create_user OR admin → evolution-provision
        cria instância no Evolution, salva em clinics.settings.evolution
2. UI mostra QR via evolution-qr (polling)
3. Usuário escaneia → connection.update event → settings.evolution.status='connected'
4. cron evolution-health a cada 5min confere estado
5. se desconectar → status='disconnected', UI sugere re-pareamento
6. evolution-logout (UI) ou evolution-delete-instance (admin)
```

---

## Pegadinhas

- **Múltiplas instâncias com mesmo nome**: Evolution rejeita. Sempre incluir `clinic_id` no nome (`mkart_<short_clinic_id>`).
- **QR expira em ~60s**: UI faz polling de 5s; após 3 tentativas, força `restart`.
- **Webhook não chega**: 95% das vezes é `EVOLUTION_BASE_URL` errado ou Evolution sem internet de saída. Conferir com `evolution-test`.
- **Mensagem outbound não aparece no celular físico**: Evolution só sincroniza via WhatsApp Web. Se o celular estiver offline >14 dias, sessão expira → re-parear.
- **Áudio**: precisa ser `audio/ogg; codecs=opus`. mp3 quebra silenciosamente (Evolution retorna 200 mas WhatsApp descarta).
- **Grupos**: tecnicamente Evolution suporta, mas a aplicação **ignora** (`remoteJid` ending `@g.us`) — não criamos lead nem persistimos.
- **Rate limit**: ~1 msg/s por instância antes do WhatsApp começar a derrubar. Acima disso, risco de ban.
- **API instável**: Evolution open-source — atualizações de versão quebram payloads. Pin a versão do servidor.

---

## Melhorias sugeridas

- Validar HMAC do webhook (hoje só apikey).
- Healthcheck mais agressivo (1min) durante envio de broadcast.
- Migrar para Cloud API oficial do WhatsApp em clínicas com volume alto.

---

## Arquivos-chave

- `supabase/functions/evolution-*/index.ts`
- `supabase/functions/_shared/evolution.ts` (helper HTTP)
- `edge-functions/WHATSAPP.md`
- `flows/INBOUND_WHATSAPP.md`, `flows/OUTBOUND_WHATSAPP.md`

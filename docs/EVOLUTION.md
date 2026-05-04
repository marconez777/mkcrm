# Integração Evolution API

[Evolution API](https://github.com/EvolutionAPI/evolution-api) é um gateway open-source para WhatsApp baseado em Baileys.

## Endpoints consumidos

- `POST /message/sendText/{instance}` — enviar texto.
- `POST /chat/findMessages/{instance}` — buscar histórico.
- `POST /webhook/set/{instance}` — registrar webhook.
- `GET  /instance/connectionState/{instance}` — status.
- `GET  /chat/fetchProfilePictureUrl/{instance}` — avatar.

Autenticação: header `apikey: <evolution_api_key>`.

## Múltiplas instâncias

A tabela `whatsapp_instances` permite cadastrar várias contas WhatsApp. Cada instância tem:
- `evolution_url`, `evolution_api_key`, `evolution_instance` (nome).
- `webhook_token` único (gerado).
- `is_default` — uma única instância default global.
- `connection_state`, `last_health_check`, `webhook_ok`.

Cada `pipeline` pode opcionalmente apontar para uma instância (`pipelines.whatsapp_instance_id`). Cada `lead` carrega `whatsapp_instance_id` que define por onde enviar/receber.

> A tabela `settings` legacy ainda existe para compatibilidade, mas novos cadastros devem usar `whatsapp_instances`.

## Configuração

Em `/settings`:
1. Cadastre a instância (URL, API key, nome).
2. Clique em **Salvar webhook** — o backend chama:
```
URL:    {SUPABASE_URL}/functions/v1/evolution-webhook?token={webhook_token}
Events: MESSAGES_UPSERT, MESSAGES_UPDATE, CONTACTS_UPSERT, CONNECTION_UPDATE
```
3. Use `evolution-health` para verificar o status.
4. Re-escaneie o QR Code pela própria Evolution se necessário.

## Eventos tratados

### `MESSAGES_UPSERT`
Mensagens novas (recebidas ou enviadas por outro device).
- `evolution-webhook` → `webhook_dedup` (dedup curta) → `ingestMessage` (idempotente por `(lead_id, external_id)`).
- Se `auto_reply` ativo no lead, enfileira/atualiza `pending_replies`.

### `MESSAGES_UPDATE`
Atualiza `delivery_status` (`delivered`, `read`) por `external_id`.

### `CONTACTS_UPSERT`
Atualiza `name` e `avatar_url` do lead. Pode disparar `fetch-wa-avatar` se o avatar vier vazio.

### `CONNECTION_UPDATE`
Salva `state` em `whatsapp_instances.connection_state` (`open`, `connecting`, `close`).

## Envio (CRM → WhatsApp)

1. UI gera `client_message_id` (UUID v4) e adiciona otimisticamente.
2. Chama `evolution-send` com body real:
   ```json
   { "lead_id": "uuid", "text": "string", "client_message_id": "uuid?", "quoted_external_id": "string?" }
   ```
3. Função insere `messages` com `status='pending'` (idempotente por `client_message_id`).
4. POST em `/message/sendText/{instance}` na instância do lead.
5. Atualiza `external_id` + `status='sent'`.
6. `MESSAGES_UPDATE` posterior atualiza `delivery_status`.

## Reconciliação

- **Manual**: botão de refresh no chat → `evolution-sync-lead` (`silent: true`).
- **Em lote**: `evolution-backfill-all` itera por todos os leads (uso pós-restauração ou troca de instância).

## Mídia e áudio

- Mídias chegam com `media_url` + `media_mime`. A UI renderiza imagem/vídeo/doc.
- Áudios podem ser enviados a `transcribe-audio`, que devolve a transcrição e atualiza `messages.content`.

## Troubleshooting

| Sintoma | Causa | Ação |
|---|---|---|
| Webhook 401 | Token inválido / instância errada | Re-salvar webhook em Settings |
| Mensagens duplicadas | Falta índice único `(lead_id, external_id)` | Verificar migration |
| Histórico antigo não importa | `findMessages` limitado | Usar `evolution-backfill-all` ou paginar |
| Grupos não aparecem | `phoneFromJid` ignora `@g.us` | Por design |
| Avatar não carrega | Número novo / sem foto | Disparar `fetch-wa-avatar` manualmente |
| `connection_state=close` | Sessão caiu | Re-escanear QR na Evolution |

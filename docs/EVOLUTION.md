# Integração Evolution API

## O que é
[Evolution API](https://github.com/EvolutionAPI/evolution-api) é um gateway open-source para WhatsApp baseado em Baileys. Este projeto consome:
- `POST /message/sendText/{instance}` — enviar texto
- `POST /chat/findMessages/{instance}` — buscar histórico
- `POST /webhook/set/{instance}` — registrar webhook
- `GET  /instance/connectionState/{instance}` — status

Autenticação: header `apikey: <EVOLUTION_API_KEY>`.

## Configuração

Em `/settings` salve:
- `evolution_url`
- `evolution_api_key`
- `evolution_instance`

Ao salvar o webhook, o backend chama a Evolution registrando:
```
URL:    {SUPABASE_URL}/functions/v1/evolution-webhook?token={webhook_token}
Events: MESSAGES_UPSERT, MESSAGES_UPDATE, CONTACTS_UPSERT, CONNECTION_UPDATE
```

## Eventos tratados

### `MESSAGES_UPSERT`
Mensagens novas (recebidas ou enviadas por outro device).
- Chama `ingestMessage` com `source='webhook'`.
- Idempotente: webhook + sync manual chegando juntos não duplicam.

### `MESSAGES_UPDATE`
Atualiza `delivery_status` (`delivered`, `read`, etc.) por `external_id`.

### `CONTACTS_UPSERT`
Atualiza `name` e `avatar_url` do lead.

### `CONNECTION_UPDATE`
Salva `state` em `settings.connection_state` (`open`, `connecting`, `close`).

## Mensagens enviadas pelo CRM

1. UI gera um `client_message_id` (UUID v4) e adiciona otimisticamente.
2. `evolution-send` insere `messages` com `status='pending'`.
3. Após `POST /message/sendText`, atualiza `external_id` + `status='sent'`.
4. Evolution depois envia `MESSAGES_UPDATE` para `delivered`/`read`.

## Troubleshooting

- **Webhook 401**: token inválido — re-salvar em Settings.
- **Mensagens duplicadas**: garantir índice único `(lead_id, external_id)` em `messages`.
- **Histórico antigo não importa**: `evolution-sync-lead` pega últimos 50; usar paginação Evolution se precisar de mais.
- **Grupos**: `phoneFromJid` retorna `null` para `@g.us` → grupos são ignorados de propósito.

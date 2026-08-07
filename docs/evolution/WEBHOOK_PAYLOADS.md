---
title: "Payloads do Webhook (Evolution)"
topic: integracao
kind: reference
audience: dev
updated: 2026-07-08
summary: "Referência dos payloads JSON enviados pelo Evolution API e mapeados no Supabase, úteis para depuração na tabela webhook_events."
---

# Webhook Payloads (Evolution API)

Todos os webhooks que batem na Edge Function `evolution-webhook` são registrados de forma bruta na tabela `webhook_events` antes de serem processados. Isso garante uma trilha de auditoria e permite "replays" caso o parsing falhe.

Abaixo estão os eventos mais comuns e seus formatos simplificados para auxiliar no debug.

## 1. `MESSAGES_UPSERT`

Disparado quando uma nova mensagem é enviada ou recebida. É o evento responsável por criar leads e atualizar o histórico (`messages`).

```json
{
  "event": "messages.upsert",
  "instance": "instancia_test",
  "data": {
    "messages": [
      {
        "key": {
          "remoteJid": "5511999999999@s.whatsapp.net",
          "fromMe": false,
          "id": "3EB0ABCDE12345"
        },
        "pushName": "Nome do Cliente",
        "message": {
          "conversation": "Olá, gostaria de saber os preços."
        },
        "messageTimestamp": 1690000000
      }
    ],
    "type": "notify"
  }
}
```
**Campos Críticos Extraídos:**
- `key.remoteJid`: Usado para extrair o telefone (ex: `5511999999999`). Cuidado com o formato LID (`@lid`), que exige tratamento especial em `phoneFromKey()`.
- `key.id`: Mapeado para `external_id` em nossa tabela `messages`.
- `message.conversation` / `message.extendedTextMessage`: Mapeado para `content`.

## 2. `MESSAGES_UPDATE` (Status)

Disparado quando o status de entrega/leitura de uma mensagem muda (Enviado, Entregue, Lido).

```json
{
  "event": "messages.update",
  "instance": "instancia_test",
  "data": [
    {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": true,
        "id": "CLIENT_MSG_ID_123"
      },
      "update": {
        "status": 3  // 2 = Entregue (Server), 3 = Entregue (Client), 4 = Lido
      }
    }
  ]
}
```
Esse evento faz um `UPDATE` direto na tabela `messages` mudando o campo `status` (`sent` -> `delivered` -> `read`).

## 3. `CONNECTION_UPDATE`

Informa o estado da instância (se conectou, se desconectou, se precisa ler QR code).

```json
{
  "event": "connection.update",
  "instance": "instancia_test",
  "data": {
    "state": "open",
    "statusReason": 200,
    "qr": "data:image/png;base64,..."
  }
}
```
A Edge Function atualiza a tabela `whatsapp_instances` com base neste evento. O campo `qr` só vem quando o `state` for `connecting`.

## 4. Tratamento de Anexos (Media)

Para `MESSAGES_UPSERT` que contêm mídia, o payload terá um formato como:
```json
"message": {
  "imageMessage": {
    "url": "https://mmg.whatsapp.net/v/...",
    "mimetype": "image/jpeg",
    "caption": "Foto do comprovante",
    "mediaKey": "..."
  }
}
```
**Regra de Ouro:** A URL fornecida no JSON é protegida/criptografada. O sistema NÃO salva essa URL diretamente. Em vez disso, a Edge retorna `needs_media=true`, acionando uma tarefa em background que chama `getBase64FromMediaMessage` do Evolution, faz o decode (`atob`), salva no bucket `chat-attachments` do Supabase e atualiza o `media_url` final na tabela `messages`.

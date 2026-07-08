---
title: "Setup & Provisionamento — Evolution API"
topic: integracao
kind: guide
audience: ops
updated: 2026-07-08
summary: "Guia operacional de como configurar o servidor global da Evolution API e gerenciar os secrets necessários para o correto funcionamento das instâncias de WhatsApp no sistema."
related_docs:
  - docs/evolution/EVOLUTION_EDGES.md
  - docs/evolution/WHATSAPP.md
---

# Setup & Provisionamento da Evolution API

Este documento destina-se a administradores do sistema (Ops/DevOps). Ele explica como o CRM se conecta à **Evolution API** e como realizar a configuração inicial para o provisionamento automático de instâncias de WhatsApp.

## 1. O Servidor Global (Evolution API)

O MK CRM não roda instâncias do Baileys localmente. Ele depende de uma API externa baseada no projeto [Evolution API](https://github.com/EvolutionAPI/evolution-api). 

Para que as Edge Functions (como `evolution-provision`) consigam solicitar a criação de instâncias de WhatsApp em tempo real quando um usuário tenta conectar na interface, o Supabase precisa conhecer as credenciais **globais** deste servidor Evolution.

### Variáveis de Ambiente no Supabase

As seguintes variáveis devem ser cadastradas no ambiente do Supabase (via Dashboard ou CLI usando `supabase secrets set`):

- `EVOLUTION_GLOBAL_URL`: URL base do servidor Evolution (ex: `https://evo.meudominio.com`). Não inclua a barra `/` no final, embora a função `evoBase()` corrija isso.
- `EVOLUTION_GLOBAL_API_KEY`: A chave global do servidor Evolution (geralmente definida como `AUTHENTICATION_GLOBAL_API_KEY` na configuração da própria Evolution API). Essa chave tem permissão para criar e deletar instâncias.

> [!WARNING]
> **Segurança**: Nunca exponha a `EVOLUTION_GLOBAL_API_KEY` para o frontend. Ela é usada exclusivamente pela edge function `evolution-provision`.

## 2. Fluxo de Provisionamento Automático

O MK CRM suporta um ecossistema **multi-instância**. Quando um cliente tenta plugar um número de WhatsApp via interface (`WhatsAppQrDialog`), a mágica acontece no backend sem intervenção manual.

1. O client invoca a Edge Function `evolution-provision`.
2. A Edge Function autentica-se no servidor Evolution usando a `EVOLUTION_GLOBAL_API_KEY`.
3. É enviada uma requisição `POST /instance/create` com configurações restritas:
   - Uma **chave de API individual** é gerada (`evolution_api_key`) apenas para essa instância.
   - O webhook é configurado apontando de volta para a nossa URL do Supabase, protegido por um `webhook_token` exclusivo daquela instância.
4. As credenciais individuais geradas (`evolution_api_key` e `webhook_token`) são salvas na tabela `whatsapp_instances`.
5. A UI prossegue gerando o QR Code chamando a rota de conectar no Evolution usando a chave recém-gerada.

## 3. Webhook Token e Configuração de Eventos

Durante o provisionamento, configuramos o Evolution para enviar webhooks de volta para o Supabase.

A URL do Webhook sempre será:
`https://<PROJETO_SUPABASE>.supabase.co/functions/v1/evolution-webhook?token=<WEBHOOK_TOKEN>`

### Eventos Assinados (`REQUIRED_EVENTS`)

É crucial que o servidor Evolution permita (e a instância esteja configurada para assinar) os seguintes eventos:
- `MESSAGES_UPSERT`
- `MESSAGES_UPDATE`
- `MESSAGES_SET`
- `MESSAGING_HISTORY_SET`
- `CHATS_UPSERT`
- `CHATS_SET`
- `CONTACTS_UPSERT`
- `CONNECTION_UPDATE`

> [!NOTE]
> O watchdog `evolution-health` monitora ativamente as instâncias. Se ele detectar que uma instância perdeu a configuração de webhook ou que os eventos assinados diferem da lista acima, ele reconfigura o webhook automaticamente.

## 4. Requisitos de Infraestrutura para o Servidor Evolution

Se você for o responsável por subir a Evolution API no Docker, certifique-se que:
- O Redis está configurado (a Evolution usa para gerenciamento de filas e sessões pesadas).
- O Postgres (ou outro DB) está ativado na Evolution para não sobrecarregar a memória.
- As variáveis `WEBHOOK_GLOBAL_ENABLED=true` não devem ser usadas, pois configuramos webhooks *por instância*.
- A Evolution consegue fazer POST para os domínios do Supabase sem bloqueios de firewall.

## 5. Validação do Setup

Para garantir que o setup está correto:
1. Abra os Logs das Edge Functions no Supabase.
2. Inicie o fluxo de "Adicionar WhatsApp" na UI do CRM.
3. Você deve ver logs 200 na function `evolution-provision`.
4. Em seguida, a tela exibirá o QR Code, gerando chamadas bem-sucedidas em `evolution-qr`.
5. Se der erro, o log mais provável é de `Unauthorized` no Evolution (problema na `EVOLUTION_GLOBAL_API_KEY`) ou `Timeout` (o Supabase não consegue pingar a `EVOLUTION_GLOBAL_URL`).

---
title: "Troubleshooting — WhatsApp & Evolution"
topic: integracao
kind: guide
audience: ops
updated: 2026-07-08
summary: "Guia de resolução de problemas comuns envolvendo a integração do WhatsApp via Evolution API: instâncias mudas, falha em mídias, rotação de webhooks e desconexões inesperadas."
related_docs:
  - docs/evolution/EVOLUTION_EDGES.md
  - docs/evolution/SETUP.md
---

# Troubleshooting de Instâncias do WhatsApp

Este guia descreve os cenários de falha mais comuns encontrados na operação do WhatsApp via Evolution API e como o time de operações pode resolvê-los.

## 1. Instâncias "Mudas" (Deaf Instances)

**Sintoma:** O status da conexão (`connection_state`) está como `open`, mas a instância parou de receber mensagens (ou enviar).

**Causa:** A comunicação entre o Baileys (Evolution) e os servidores da Meta pode ter "congelado", ou o webhook falhou e o Evolution parou de tentar.

**Solução Automática (Watchdog):**
O sistema possui o `evolution-health` que roda a cada 1 minuto.
- Se a instância ficar 30 minutos sem receber eventos (Stale), mas for confirmada como `open` na Evolution, o sistema considera suspeito.
- Aos 120 minutos (`DEAF_THRESHOLD_MIN`), o watchdog fará um `auto_restart`, acionando a rota `/instance/restart` e registrando isso no log da tabela `whatsapp_instances` (`auto_restart_count`).

**Ação Manual:**
Caso você não queira esperar o watchdog:
1. Vá até as configurações de WhatsApp da Clínica.
2. Não delete a instância. Simplesmente informe o cliente para reiniciar o app no celular, ou chame a RPC/Edge de `evolution-restart` se houver painel admin.

## 2. Rotação Manual de Webhook Token

**Sintoma:** Suspeita de que o `webhook_token` vazou (alguém está disparando requisições falsas para a edge `evolution-webhook`).

**Problema (Débito Técnico):** Atualmente, não há uma interface na UI para rotacionar o token sem deletar a instância.

**Solução (Workaround):**
É necessário atualizar tanto no banco quanto na Evolution API simultaneamente:
1. Gere um novo token (UUID ou Hash aleatório).
2. Vá ao banco de dados Supabase e faça o update:
   ```sql
   UPDATE whatsapp_instances 
   SET webhook_token = 'NOVO_TOKEN' 
   WHERE id = 'ID_DA_INSTANCIA';
   ```
3. Use um cliente HTTP (Postman/Curl) para bater na URL da Evolution (`POST /webhook/set/{nome_da_instancia}`) passando a `evolution_api_key` da instância no header e a nova URL:
   ```json
   {
     "webhook": {
       "enabled": true,
       "url": "https://<PROJETO>.supabase.co/functions/v1/evolution-webhook?token=NOVO_TOKEN",
       "events": [
         "MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_SET",
         "MESSAGING_HISTORY_SET", "CHATS_UPSERT", "CHATS_SET",
         "CONTACTS_UPSERT", "CONNECTION_UPDATE"
       ]
     }
   }
   ```

## 3. Falha no Download de Mídias

**Sintoma:** O usuário recebe uma mensagem com anexo (imagem/áudio), mas o player não carrega.

**Causas:**
- A mensagem veio criptografada do WhatsApp (MD) e a Evolution não conseguiu fazer o un-cryption (`atob`).
- O webhook processou o lead muito rápido, mas a chamada paralela para baixar a mídia na edge (`evolution-webhook` via `downloadAndStoreMedia`) falhou por timeout ou bucket cheio/inválido.

**Como verificar:**
1. Verifique na tabela `messages` se a coluna `media_url` está preenchida com um link do Supabase Storage ou se está nula.
2. Se estiver nula, mas `raw->message` indicar que há um `imageMessage` ou `audioMessage`, o download falhou silenciosamente.
3. **Solução:** No momento não há um botão de "retentar download" no frontend. A única maneira de forçar é chamar a Edge `evolution-sync-lead` para o lead em questão, que fará um fetch recente e tentará baixar as mídias ausentes.

## 4. Deslogamentos Inesperados (Auto-Logout)

**Sintoma:** O cliente reclama que a instância "caiu" e pede QR code novamente do nada.

**Causa:**
1. O cliente deliberadamente desconectou o aparelho no menu do WhatsApp Web no celular.
2. O watchdog (`evolution-health`) acionou a "Escalada Final".

**Escalada Final do Watchdog:**
Se uma instância fica "muda" e um `restart` não resolve, após 240 minutos (`AUTO_LOGOUT_THRESHOLD_MIN`), o watchdog dispara o `evolution-logout`. Isso derruba a sessão presa na Evolution para evitar consumo de memória fantasma e obriga o cliente a ler o QR Code novamente.

## 5. Webhooks Duplicados

**Sintoma:** Lentidão no banco ou log mostrando múltiplos `evolution-webhook` no mesmo milissegundo.
**Solução (já implementada):**
A Evolution tenta re-enviar eventos se o Supabase não responder rápido o suficiente. Implementamos a tabela `webhook_dedup`.
Se você ver logs de duplicatas, não se preocupe: a lógica de `webhook_dedup` e a trava de banco de dados no Postgres (veja `WEBHOOK_EVOLUTION.md`) barram essas tentativas com segurança. Apenas garanta que o banco não está gargalando em I/O.

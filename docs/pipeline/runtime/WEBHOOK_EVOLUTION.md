---
title: "Webhook e Mensageria Evolution API (V6)"
topic: integration
kind: reference
audience: agent
updated: 2026-06-20
summary: "Documentação do sistema de mensageria da Evolution API. Como as mensagens entram, o controle anti-corrida (23505), a lib compartilhada e como o sistema despacha mídias e textos."
code_refs:
  - supabase/functions/_shared/evolution.ts
  - supabase/functions/evolution-webhook/index.ts
  - supabase/functions/evolution-send/index.ts
---

# Webhook e Mensageria Evolution API

Todo o tráfego do WhatsApp da clínica passa pelas APIs do projeto Evolution. A integração é via Webhooks de entrada e REST API de saída, gerenciados por Edge Functions dedicadas.

## 1. Recepção de Mensagens (`evolution-webhook`)

Quando o celular recebe uma mensagem (texto, áudio, imagem), a Evolution API posta um payload para a função `evolution-webhook`.

### O Problema da Corrida de Webhooks (Race Condition)

Se o paciente enviar 5 mensagens rápidas, a Evolution fará 5 requisições simultâneas ao Webhook. Anteriormente, isso causava a inserção de 5 leads duplicados para o mesmo número.

### A Solução Estrita

A plataforma hoje lida com a concorrência usando o modelo de **Upsert Seguro com Captura de Erro 23505**:

1. Há um índice de banco `UNIQUE INDEX leads_clinic_phone_uniq` (garante que 1 clínica não tenha 2 leads com mesmo telefone).
2. O webhook tenta inserir o lead no banco de forma otimista.
3. Se dois webhooks baterem ao mesmo tempo, o segundo falha com erro Postgres `23505` (Unique Violation).
4. O código na função `_shared/evolution.ts` captura o erro 23505 num `try-catch`, não quebra a execução, e imediatamente busca (`SELECT`) o ID do lead recém-criado pelo primeiro webhook.
5. Ambas as requisições prosseguem e anexam as mensagens à mesma linha de lead de forma atômica.

### Atualização Contínua do Lead

Além de criar mensagens em `messages`, o webhook faz:
- Seta `needs_ai_review = true` (Ativa o Gatilho para a classificação dos Agentes V6).
- Atualiza `last_message_at`, `last_message_preview` e `unread_count`.

## 2. Envio de Mensagens (`evolution-send` e `_shared/evolution.ts`)

O envio de mensagens do CRM para o WhatsApp é gerenciado pelo módulo compartilhado `sendMessageToEvolution()`. 

A função é capaz de enviar textos simples, ou anexar `mediaUrl` + `mediaType` para enviar arquivos (PDFs, imagens e áudios).

### Fila e Assincronia

- Não seguramos a interface do usuário esperando a resposta da Evolution. O envio pela UI faz um POST para `evolution-send`, que retorna sucesso rápido, enquanto a entrega real corre por baixo.
- Mensagens de automação ou e-mails que engatilham WhatsApp também batem nessa mesma função.

## 3. Controle de Instâncias e Sessões

Funções de suporte existem para manter a conexão ativa (pareamento do WhatsApp):
- `evolution-qr`: Busca QRCode para a secretária escanear.
- `evolution-health` e `evolution-status`: Conferem se a bateria está acabando, se a conexão caiu ou se está sincronizando mensagens.
- `evolution-restart`: Reinicia o worker da API Evolution em caso de travamento.

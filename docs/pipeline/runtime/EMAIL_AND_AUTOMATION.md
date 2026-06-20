---
title: "Fila de E-mails e Automações"
topic: backend
kind: reference
audience: agent
updated: 2026-06-20
summary: "Como o process-email-queue envia mensagens em massa agrupando chamadas do Resend. Gestão de rate limits, backoff e disparos agendados."
code_refs:
  - supabase/functions/process-email-queue/index.ts
  - supabase/functions/send-email-batch/index.ts
---

# Fila de E-mails e Automações

O módulo de e-mail é projetado para operar assincronamente a fim de não onerar a experiência do usuário e otimizar os custos na API do Resend.

## 1. Funcionamento da Fila (`process-email-queue`)

Quando um usuário dispara um "Envio em Massa" na UI ou um e-mail é agendado por uma cadência, os registros são inseridos na tabela `email_queue` com o status `pending` e uma coluna `scheduled_at`.

A Edge Function `process-email-queue` é acionada por um Cron (Tick) a cada 1 a 5 minutos, e realiza:

### Reaper (Ceifador de Fantasmas)
Identifica jobs que estão travados em `processing` há mais de 10 minutos (pois a execução quebrou silenciosamente) e retorna-os para `pending` para repescagem.

### Agrupamento (Batch API)
Ao invez de efetuar 1000 chamadas HTTPS separadas ao Resend (o que estouraria o Rate Limit e deixaria o sistema lento), a função agrupa os envios que possuem o mesmo remetente (Clinic/Domain) e mesmo template, disparando-os usando a Rota Bulk (`send-email-batch`), processando até 100 envios de uma só vez por requisição REST.

### Tratamento de Falhas e Rate Limits
Se a chamada falhar, o sistema categoriza a falha e toma ações específicas:
- **Rate Limit ("Retry-After"):** Aguarda exatos X segundos estipulados pela Resend e coloca de volta no `pending` somado de um _jitter_ aleatório para evitar a chamada trovejada.
- **Quota Excedida (Cota Diária):** Remarca todos os jobs para re-tentativa às 12:00 BRT (09:00 PST) do dia seguinte, momento em que o Resend vira a cota mensal/diária.
- **Erro Permanente (Bounce Hard, Domínio não verificado):** Marca permanentemente como `failed` após esgotar o máximo de `MAX_ATTEMPTS` (3), ou de imediato dependendo do grau do erro.

## 2. Automações de Cron (`automations-tick` e `email-automations-tick`)

Existem Edge Functions separadas para varrer e disparar ações programadas pelo usuário no módulo "Automações":

1. Lê a tabela de regras (Ex: Se Estágio X estiver parado por 3 dias).
2. Para cada Lead enquadrado, injeta um comando na tabela de e-mails (`email_queue`) ou de WhatsApp (`evolution-send`).
3. Assina o evento para não disparar duas vezes para o mesmo Lead (Idempotência controlada).

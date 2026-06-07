---
title: Fila de Email
topic: email
kind: support
audience: user
updated: 2026-06-07
summary: Aba **Fila** no Email Hub → `/email/queue`.
---
# Fila de Email

**Rota:** `/email/queue`  
**Arquivo:** `src/pages/email/EmailQueue.tsx`

---

## Como acessar

Aba **Fila** no Email Hub → `/email/queue`.

---

## Layout

### Filtros (chips/botões)
`Todos` · `pending` · `sending` · `sent` · `failed` · `cancelled`

### Botões de ação
- **Atualizar** (ícone RefreshCw)
- **Processar agora** — invoca edge function `process-email-queue`

### Tabela
Colunas: **Destinatário** (email + nome) · **Template** · **Status** · **Tentativas** · **Agendado** (tempo relativo em PT-BR) · **Erro** · **Ações**

Ações por linha:
- `failed` ou `cancelled`: botão **Reprocessar** → status volta a `pending`, `attempts` zerado, invoca `process-email-queue`
- `pending` ou `failed`: botão **Cancelar** → status → `cancelled`

Estado vazio: *"Sem itens na fila"*

### Realtime
Atualização automática via Supabase Realtime (`email_queue_changes` channel) ao detectar qualquer mudança na tabela `email_queue`.

---

## Toasts

| Situação | Toast |
|---|---|
| Processamento disparado | *"Processamento disparado"* |
| Falha ao processar | *"Falha ao processar"* |
| Item cancelado | *"Cancelado"* |
| Item reagendado | *"Reagendado para agora"* |

---

## Tabela consultada: `email_queue`

Campos: `id, recipient_email, recipient_name, template_slug, status, attempts, scheduled_at, sent_at, error, created_at`

Status possíveis: `pending` · `sending` · `sent` · `failed` · `cancelled` · `paused`

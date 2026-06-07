---
title: Descadastros
topic: email
kind: support
audience: user
updated: 2026-06-07
summary: Aba **Descadastros** no Email Hub → `/email/unsubscribes`.
---
# Descadastros

**Rota:** `/email/unsubscribes`  
**Arquivo:** `src/pages/email/EmailUnsubscribes.tsx`

---

## Como acessar

Aba **Descadastros** no Email Hub → `/email/unsubscribes`.

---

## Layout

### Filtros e ações
- Campo de busca por email (Enter aplica)
- Botão **Rodar backfill** — invoca edge function `backfill-resend-events` para sincronizar eventos históricos
- Botão **Atualizar**

### Tabela
Colunas: **E-mail** · **Motivo** · **Origem** · **Data** (dd/MM/yyyy HH:mm) · **Ações** (ícone Trash2)

Estado vazio: *"Nenhum descadastro"*

---

## Remover descadastro

Confirm: *"Remover descadastro? {email} voltará a poder receber e-mails."* (destrutivo)  
Toast sucesso: *"Removido"*

---

## Toasts

| Situação | Toast |
|---|---|
| Backfill disparado | *"Backfill disparado"* |
| Falha no backfill | *"Falha"* ou mensagem da edge function |
| Removido | *"Removido"* |

---

## Tabela consultada: `email_unsubscribes`

Campos: `email, clinic_id, unsubscribed_at, reason, source`

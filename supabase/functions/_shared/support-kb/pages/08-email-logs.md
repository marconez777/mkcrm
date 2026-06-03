# Logs de Email

**Rota:** `/email/logs`  
**Arquivo:** `src/pages/email/EmailLogs.tsx`

---

## Como acessar

Aba **Logs** no Email Hub → `/email/logs`.

---

## Layout

### Filtros
- Chips/botões: `Todos` · `sent` · `delivered` · `opened` · `clicked` · `bounced` · `complained` · `failed`
- Campo de busca por email (com ícone Search); confirmar com **Enter** aplica a busca
- Botão **Atualizar** (ícone RefreshCw)

### Tabela
Colunas: **Destinatário** · **Assunto** · **Template** · **Status** · **Enviado** (dd/MM HH:mm) · **Eventos** (badges de eventos adicionais: delivered, opened, clicked, bounced, complained)

Estado vazio: *"Sem logs"*

---

## Tabela consultada: `email_logs`

Campos: `id, recipient_email, template_slug, subject, status, resend_id, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at, error`

Ordenação: `sent_at DESC`. Paginação: PAGE_SIZE por página.

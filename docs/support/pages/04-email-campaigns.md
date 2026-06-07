---
title: Campanhas de Email
topic: email
kind: support
audience: user
updated: 2026-06-07
summary: Aba **Campanhas** no Email Hub → `/email/campaigns`.
---
# Campanhas de Email

**Rota:** `/email/campaigns`  
**Arquivo:** `src/pages/email/EmailCampaigns.tsx`  
**Título da página:** `"Email — Campanhas"`

---

## Como acessar

Aba **Campanhas** no Email Hub → `/email/campaigns`.

---

## Layout da tela

### Cabeçalho
- Título: **"Campanhas de Email"**
- Legenda: *"Envios únicos para listas segmentadas."*
- Botão **Nova campanha**

### Tabela de campanhas
Colunas: **Nome** · **Template** · **Segmento** · **Status** · **Enviados** (com barra de progresso) · **Agendada** · **Ações**

Estado vazio: *"Nenhuma campanha ainda."*

### Ações por campanha (coluna direita)

| Status da campanha | Botões disponíveis |
|---|---|
| `sending` | **Ao vivo** (abre CampaignLiveDialog com pulso animado) |
| Outros | **Relatório** |
| `draft`, `scheduled` | ícone Editar (lápis) · ícone Enviar (send) |
| `sending`, `scheduled` | ícone Pausar |
| `paused` | ícone Retomar |
| Todos | ícone Duplicar · ícone Excluir |

---

## Dialog: Nova / Editar campanha

### Campos

| Campo | Tipo | Observações |
|---|---|---|
| Nome | Input | obrigatório |
| Template | Select | Lista de templates ativos |
| Nome de exibição (De) | Input | Sobrescreve o remetente do template nesta campanha; deixe vazio para usar o do template |
| Segmentos | Multi-select (Popover com Checkbox) | Vazio = "Todos os leads" |
| Agendar para | Input datetime-local | Se preenchido, salva com status `scheduled` |
| Email de teste | Input email | Pré-preenchido com email do usuário logado |

- Preview de destinatários renderizado abaixo do seletor de segmentos (componente `CampaignRecipientsPreview`)
- Timestamp do último teste enviado

### Botões do dialog
**Cancelar** · **Enviar teste** · **Salvar**

---

## Ações e toasts

| Ação | Toast |
|---|---|
| Salvar sem nome/template | *"Preencha nome e template"* |
| Salvar com sucesso | *"Campanha salva"* |
| Enviar teste sem salvar primeiro | *"Salve a campanha antes de enviar teste"* |
| Enviar teste sem email | *"Informe o email de teste"* |
| Teste enviado | *"Teste enviado para {email}"* |
| Disparar campanha | Confirm: *"Enviar campanha '...' agora? Os e-mails serão enfileirados imediatamente."* → toast *"Campanha em envio"* |
| Pausar | Confirm → *"Campanha pausada"* |
| Retomar | (sem confirm) → *"Campanha retomada"* + invoca `process-email-queue` |
| Duplicar | Cria cópia com nome `"(cópia)"` e status `draft` → *"Campanha duplicada"* |
| Excluir | Confirm (destrutivo) → *"Excluída"* |

---

## Status de campanha (labels PT-BR via StatusBadge)

`rascunho` · `agendada` · `enviando` (com ponto pulsante) · `enviada` · `pausada` · `falhou`

---

## Tabelas / Edge Functions

- `email_campaigns`: SELECT (paginado, PAGE_SIZE itens), INSERT, UPDATE, DELETE
- `email_templates`: SELECT (ativos)
- `email_segments`: SELECT
- `email_logs` / `email_queue`: SELECT para contagem de sent/failed por campanha
- Edge `dispatch-campaign`: disparo e envio de teste
- Edge `process-email-queue`: chamado ao retomar campanha

---

## Regras de negócio

- Paginação: PAGE_SIZE linhas por página (definido em `TablePager`).
- `segment_ids` (array) é a forma canônica; `segment_id` é mantido por retrocompatibilidade quando há exatamente 1 segmento.
- Ao agendar: `scheduled_for` em ISO 8601; status vira `scheduled`.
- Pausar: atualiza `email_queue` (status `pending` → `paused`) e `email_campaigns` (status → `paused`).
- Retomar: `email_queue` (paused → pending), determina próximo status da campanha baseado em `sent_count` e `scheduled_for`.
- Disparo (`dispatch-campaign`) aceita parâmetro `test_only: true` para envio de teste sem disparar a lista completa.

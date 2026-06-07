---
title: Relatórios de Email
topic: email
kind: support
audience: user
updated: 2026-06-07
summary: Aba **Relatórios** no Email Hub → `/email/reports`.
---
# Relatórios de Email

**Rota:** `/email/reports`  
**Arquivo:** `src/pages/email/EmailReports.tsx`

---

## Como acessar

Aba **Relatórios** no Email Hub → `/email/reports`.

---

## Layout

### Cabeçalho
- Título: **"Relatórios de e-mail"**
- Legenda: *"Performance por template e por campanha."*
- Seletor de período: **7 dias** · **30 dias** · **90 dias**
- Botão **CSV** — exporta os dados exibidos

### Abas
| Aba | O que exibe |
|---|---|
| **Por template** | Select de template + métricas do template no período |
| **Por campanha** | Select de campanha (nome · status) + métricas da campanha |

### Cards de métricas (StatsView)
`Enviados` · `Entregues (%)` · `Open rate (%)` · `Click rate (%)` · `Bounces` · `Reclamações` · `Falhas` · `Melhor hora`

### Funil
Barras de progresso: Enviados → Entregues → Abertos → Cliques

### Gráfico de distribuição por hora (BRT)
BarChart agrupado (Enviados + Abertos) por hora do dia (0h–23h)

Estado vazio: *"Sem dados para esta seleção."* / *"carregando…"*

---

## Exportar CSV

Colunas: `item, sent, delivered, opened, clicked, bounced, complained, failed, open_rate, click_rate, bounce_rate, best_hour`  
Nome do arquivo: `report-{templates|campaigns}-{timestamp}.csv`

---

## RPCs utilizadas

| RPC | Parâmetros |
|---|---|
| `report_template_stats` | `_clinic_id, _template_slug, _from, _to` |
| `report_campaign_stats` | `_clinic_id, _campaign_id` |

Toast erro: *"Erro ao carregar"* + descrição do erro do banco.

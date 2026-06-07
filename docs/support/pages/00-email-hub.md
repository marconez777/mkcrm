---
title: Email Hub — Visão Geral do Módulo
topic: email
kind: support
audience: user
updated: 2026-06-07
summary: Navegue para o menu **Email Marketing** na barra lateral principal. O hub é um contêiner que renderiza as sub-páginas dentro de um sistema de abas (CategoryTabs).
---
# Email Hub — Visão Geral do Módulo

**Rota:** `/email` (e todas as sub-rotas `/email/*`)  
**Arquivo:** `src/pages/email/EmailHub.tsx`  
**Feature flag:** `email_marketing` (verificada em `SettingsEmailDomain.tsx:17`)

---

## Como acessar

Navegue para o menu **Email Marketing** na barra lateral principal. O hub é um contêiner que renderiza as sub-páginas dentro de um sistema de abas (CategoryTabs).

## Abas disponíveis

| Valor (path) | Label | Ícone |
|---|---|---|
| `/email` | Dashboard | LayoutDashboard |
| `/email/templates` | Templates | FileText |
| `/email/automations` | Automações | Workflow |
| `/email/campaigns` | Campanhas | Send |
| `/email/reports` | Relatórios | BarChart3 |
| `/email/segments` | Segmentos | Users |
| `/email/contacts` | Contatos | Contact |
| `/email/queue` | Fila | ListOrdered |
| `/email/logs` | Logs | ScrollText |
| `/email/unsubscribes` | Descadastros | UserMinus |

> Fonte: `EmailHub.tsx:28-39`

## Comportamento de navegação

- A aba ativa é determinada pelo `location.pathname` atual.
- Clicar numa aba executa `navigate(tab.path)` — sem reload de página.
- Aria-label do componente de abas: `"Seções de Email"`.

## Configurações de domínio

Acessível via **Configurações → Domínio de Email** (`/settings/email-domain`). Requer a feature `email_marketing` ativa para exibir conteúdo; caso contrário exibe mensagem: *"O recurso de Email Marketing não está ativo para esta clínica. Peça ao suporte para liberar."*

---

## Tabelas Supabase usadas pelo módulo (consolidado)

| Tabela | Uso principal |
|---|---|
| `email_logs` | Histórico de envios individuais |
| `email_queue` | Fila de envios pendentes/agendados |
| `email_templates` | Templates de email |
| `email_template_folders` | Pastas de organização de templates |
| `email_campaigns` | Campanhas de disparo em massa |
| `email_automations` | Automações baseadas em eventos |
| `email_automation_enrollments` | Leads matriculados em automações |
| `email_segments` | Segmentos (listas dinâmicas ou estáticas) |
| `email_segment_contacts` | Contatos manuais/estáticos em segmentos |
| `email_domains` | Domínios remetentes configurados |
| `email_unsubscribes` | Lista de descadastrados |
| `email_send_state` | Estado de envio diário (contador de cota) |
| `email_daily_metrics` | Métricas agregadas por dia (hook `useEmailMetrics`) |
| `leads` | Leads com email (fonte de contatos) |
| `clinics` | Configurações de cota e padrões de envio |
| `clinic_members` | Associação usuário → clínica |
| `pipeline_stages` | Etapas de pipeline (usadas em segmentos) |

## Edge Functions invocadas

| Função | Onde é chamada | O que faz |
|---|---|---|
| `dispatch-campaign` | `EmailCampaigns.tsx:183,200` | Enfileira/dispara uma campanha; aceita `test_only: true` para envio de teste |
| `process-email-queue` | `EmailQueue.tsx:68`, `EmailCampaigns.tsx:261` | Processa itens pendentes da fila de envio |
| `send-email` | `EmailTemplates.tsx:168`, `EmailTemplateEditor.tsx:278` | Envia email diretamente (testes, força `force: true`) |
| `email-domain-manage` | `DnsWizard.tsx:178` | Verifica registros DNS do domínio (action: `verify`) |
| `backfill-resend-events` | `EmailUnsubscribes.tsx:62` | Sincroniza eventos históricos do Resend |

## RPCs Supabase

| RPC | Arquivo | O que faz |
|---|---|---|
| `resolve_email_segment` | `EmailSegments.tsx:165,356` | Resolve contatos de um segmento dinâmico |
| `resolve_email_segment_preview` | `EmailSegments.tsx:262` | Preview ao vivo de filtros (sem salvar) |
| `report_template_stats` | `EmailReports.tsx:307` | Estatísticas de um template por período |
| `report_campaign_stats` | `EmailReports.tsx:325` | Estatísticas de uma campanha |


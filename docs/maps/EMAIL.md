---
title: "Mapa: Email (campanhas, automações, transacional)"
topic: email
kind: map
audience: agent
updated: 2026-06-07
summary: "Subsistema de email: campanhas em massa, automações (drip / trigger), templates com editor de blocos, fila pgmq, suppression list, unsubscribe, domínios verificados, métricas (open/click/bounce), logs."
---
# Mapa: Email (campanhas, automações, transacional)

> **Para localizar edições.** Para entender *por quê*, leia [`docs/features/EMAIL_CAMPAIGNS.md`](../features/EMAIL_CAMPAIGNS.md), [`docs/edge-functions/EMAIL.md`](../edge-functions/EMAIL.md), [`docs/integrations/RESEND.md`](../integrations/RESEND.md).
> **Última atualização:** 2026-06-03

---

## 1. O que é

Subsistema de email: campanhas em massa, automações (drip / trigger), templates com editor de blocos, fila pgmq, suppression list, unsubscribe, domínios verificados, métricas (open/click/bounce), logs.

## 2. Rotas / pontos de entrada

| Rota | Componente | Função |
|---|---|---|
| `/email` | `src/pages/email/EmailHub.tsx` | hub principal |
| `/email/dashboard` | `EmailDashboard.tsx` | métricas agregadas |
| `/email/campaigns` | `EmailCampaigns.tsx` | lista + criação de campanhas |
| `/email/automations` | `EmailAutomations.tsx` | drip / triggers |
| `/email/templates` | `EmailTemplates.tsx` + `EmailTemplateEditor.tsx` | editor de blocos |
| `/email/contacts` | `EmailContacts.tsx` | contatos |
| `/email/segments` | `EmailSegments.tsx` | segmentos |
| `/email/queue` | `EmailQueue.tsx` | fila pgmq + DLQ |
| `/email/logs` | `EmailLogs.tsx` | `email_send_log` |
| `/email/reports` | `EmailReports.tsx` | relatórios |
| `/email/unsubscribes` | `EmailUnsubscribes.tsx` | suppression list |
| `/settings/email-domain` | `SettingsEmailDomain.tsx` | DNS / domínios |
| `/unsubscribe?token=…` | `src/pages/Unsubscribe.tsx` | público |

## 3. Frontend

### Componentes (`src/components/email/`)
| Arquivo | Função |
|---|---|
| `editor/Canvas.tsx`, `Inspector.tsx`, `Palette.tsx`, `TipTapEditor.tsx` | Editor visual de blocos |
| `live/CampaignLiveDialog.tsx`, `ThroughputChart.tsx`, `RadialProgress.tsx`, `LivePulseDot.tsx`, `ArtisticSpinner.tsx` | Modal "ao vivo" durante dispatch |
| `CampaignRecipientsPreview.tsx` | Preview da audiência antes de enviar |
| `CampaignReportDialog.tsx` / `AutomationReportDialog.tsx` | Relatórios |
| `DnsWizard.tsx` + `DomainHealthCard.tsx` | Setup de domínio |
| `StatusBadge.tsx`, `TablePager.tsx` | Primitivos compartilhados |

### Libs (`src/lib/email/`)
- `blocksToHtml.ts` / `htmlToBlocks.ts` — serialização do editor.
- `sanitize.ts` — DOMPurify pré-render.
- `types.ts` — tipos de bloco.
- `variables.ts` — tokens dinâmicos disponíveis no template.

### Hooks
- `src/hooks/useEmailMetrics.ts` — métricas agregadas (open/click/bounce).

## 4. Edge functions

### Núcleo
| Function | Função |
|---|---|
| `send-email/index.ts` | envio unitário (transacional, hooks) |
| `send-email-batch/index.ts` | envio em lote |
| `process-email-queue/index.ts` | worker pgmq, roda a cada 5s via pg_cron |
| `dispatch-campaign/index.ts` | enfileira campanha (audiência → fila) |
| `process-scheduled-campaigns/index.ts` | dispara campanhas agendadas |
| `email-automations-tick/index.ts` | tick cron das automações |
| `email-domain-manage/index.ts` | CRUD de domínios + DNS |
| `email-unsubscribe/index.ts` | endpoint público do token |
| `resend-webhook/index.ts` | webhook de eventos Resend (delivered/bounce/complaint/open/click) |
| `backfill-resend-events/index.ts` | reconciliação histórica (super_admin) |
| `daily-summary/index.ts` | resumo diário |
| `scheduled-report-tick/index.ts` | tick de relatórios agendados |

### Compartilhado
- `_shared/email.ts` — wrapper de envio (gateway Resend, dedupe, suppression check).
- `_shared/template-vars.ts` — resolução de variáveis (`{{name}}`, etc.).

## 5. Banco de dados

### Tabelas
| Tabela | Função |
|---|---|
| `email_send_log` | **source of truth**. Dedupe por `message_id` (pode ter várias linhas: `pending` → `sent`/`dlq`). |
| `email_send_state` | config single-row (batch_size, send_delay_ms, TTL). |
| `suppressed_emails` | bounces, complaints, unsubscribes. |
| `email_unsubscribe_tokens` | 1 token por endereço. |
| `email_campaigns` | campanhas |
| `email_campaign_recipients` | audiência calculada |
| `email_automations` + `email_automation_runs` | automações |
| `email_templates` | templates do editor de blocos |
| `email_contacts` + `email_segments` | contatos e segmentos |
| `email_domains` | domínios verificados (NS / DKIM / SPF) |
| `pgmq.q_auth_emails`, `pgmq.q_transactional_emails` | filas pgmq (não tocar manualmente) |

### pg_cron
- `process-email-queue` (a cada 5s) — sem isso a fila não roda.
- `email-automations-tick`, `process-scheduled-campaigns`, `scheduled-report-tick`, `daily-summary`.

### RPCs
- `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq` — SECURITY DEFINER (não recriar à mão).

### Triggers
- `trg_email_logs_suppress_on_bounce` — alimenta `suppressed_emails`.
- `trg_email_queue_campaign_counters` — atualiza counters da campanha.

## 6. Integrações externas

- **Resend** via Lovable Email infrastructure. Secret: `LOVABLE_API_KEY`.
- **DNS** delegado via NS records para `ns3/ns4.lovable.cloud`.
- Webhook Resend → `resend-webhook` edge.

## 7. Invariantes — "não toque sem ler"

1. **Dedupe por `message_id`.** Toda query de stats/lista deve usar `DISTINCT ON (message_id) ORDER BY message_id, created_at DESC`. Sem isso, contagens ficam erradas.
2. **Não criar infra de fila manualmente.** Sempre via `email_domain--setup_email_infra`. Recriar pgmq/RPC/cron à mão quebra Vault secret.
3. **`SENDER_DOMAIN`** é o subdomínio verificado (`notify.example.com`). `FROM_DOMAIN` pode ser raiz.
4. **Suppression é checada ANTES do envio.** Nunca pular.
5. **`message_id` é a chave de idempotência.** Trigger deve passar key estável derivada do evento (`booking-confirm-<uuid>`).
6. **Não loopar destinatários no caller.** 1 trigger = 1 destinatário. Bulk só via `dispatch-campaign` que enfileira individualmente.
7. **Templates de auth e templates de app são separados.** Não misturar. Auth via `auth-email-hook`, app via `send-email`/`send-transactional-email`.
8. **Templates não devem ter unsubscribe manual.** O sistema appenda footer.
9. **Sem attachments** — usar link de Storage.
10. **Dashboard de logs é restrito a admin** — RLS de `email_send_log` reflete isso.

## 8. Pegadinhas

- Test/dev pode funcionar e Live falhar se faltar cron em prod — re-publicar provisiona via OnPublish hook.
- 5 tentativas falhadas → DLQ. Auth TTL 15min, app 60min.
- `auth_emails` é nome da **fila pgmq**, não `template_name` (rows de auth usam `signup`/`magiclink`/etc).
- 401/403 em queue após rotação de service_role → re-rodar `setup_email_infra` (refresca Vault secret `email_queue_service_role_key`).
- Mudou template `.tsx` → precisa `deploy_edge_functions` (`send-email`, `send-email-batch`).
- Editor de blocos serializa para HTML inline-styled — não usar CSS externo nem `<style>` (mail clients descartam).
- DNS conflito: subdomínio `notify.example.com` delegado a Lovable bloqueia Resend/SendGrid direto no mesmo subdomínio.

## 9. Receitas

### Adicionar novo template transacional
1. Criar `.tsx` em `supabase/functions/_shared/transactional-email-templates/` (React Email).
2. Registrar em `registry.ts` (`TEMPLATES` map).
3. `deploy_edge_functions` para `send-email` (ou `send-transactional-email` se for nome em uso).
4. Trigger: `supabase.functions.invoke('send-email', { body: { templateName, recipientEmail, idempotencyKey, templateData } })`.

### Adicionar evento ao webhook Resend
1. `resend-webhook/index.ts` — branch novo no handler.
2. Persistir em `email_send_log` (status) ou `suppressed_emails` (se bounce/complaint).
3. Atualizar trigger correspondente se afetar counters de campanha.

### Adicionar campo ao editor de blocos
1. Tipo em `src/lib/email/types.ts`.
2. Componente do bloco em `src/components/email/editor/Palette.tsx` + Canvas/Inspector.
3. Serialização em `blocksToHtml.ts` + `htmlToBlocks.ts`.
4. Sanitização em `sanitize.ts` (whitelist de tags/atributos).

### Debug "email não chega"
Seguir checklist em [`docs/operations/OBSERVABILITY.md`] — resumido:
1. `email_send_log` última row do `recipient_email` — status?
2. `suppressed_emails` — bloqueado?
3. pgmq queue tem cron? (`SELECT * FROM cron.job WHERE jobname = 'process-email-queue'`)
4. Logs de `process-email-queue` — 4xx/5xx do Resend?
5. Domínio: `email_domains.status = 'active'`?

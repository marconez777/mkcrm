---
title: "Email Marketing"
topic: email
kind: map
audience: agent
updated: 2026-07-01
summary: "Runtime completo de email marketing: templates, campanhas A/B, automações, fila, throttling multi-camada, webhooks Resend, dashboard e unsubscribe."
code_refs:
  - src/pages/email/
  - src/components/email/
  - src/hooks/useEmailMetrics.ts
  - src/pages/Unsubscribe.tsx
  - supabase/functions/send-email/
  - supabase/functions/send-email-batch/
  - supabase/functions/process-email-queue/
  - supabase/functions/dispatch-campaign/
  - supabase/functions/process-scheduled-campaigns/
  - supabase/functions/email-automations-tick/
  - supabase/functions/email-domain-manage/
  - supabase/functions/email-unsubscribe/
  - supabase/functions/resend-webhook/
  - supabase/functions/backfill-resend-events/
  - supabase/functions/outreach-recovery-tick/
  - supabase/functions/_shared/email.ts
related_docs:
  - docs/maps/AUTOMATIONS.md
  - docs/maps/BROADCASTS.md
  - docs/maps/PIPELINE_RUNTIME.md
---

# Email Marketing — Mapa Runtime

Provedor único: **Resend** (via API pública ou key por clínica em
`clinic_email_integrations`). O sistema é **multi-tenant por `clinic_id`**,
gated por feature flag `email_marketing` (`clinic_has_feature` RPC).

## 1. Frontend (`src/pages/email/` + `src/components/email/`)

Rotas em `src/App.tsx:181-194` — todas dentro de
`FeatureRoute feature="email_marketing"`.

`EmailHub` é o wrapper com `CategoryTabs` que renderiza 10 views internas
(cada rota `/email/*` cai no mesmo componente e o pathname decide a tab):

| Rota | Componente | Papel |
|---|---|---|
| `/email` | `EmailDashboard` (579 LOC) | KPIs por período (via `useEmailMetrics`), gráficos de entrega/engajamento |
| `/email/templates` | `EmailTemplates` + `EmailTemplateEditor` | CRUD de `email_templates` (slug, from_email, subject, html, text, reply_to, folder) |
| `/email/automations` | `EmailAutomations` | CRUD de `email_automations` + `AutomationReportDialog` |
| `/email/campaigns` | `EmailCampaigns` (554 LOC) | CRUD de `email_campaigns`, agendamento, A/B via `email_campaign_variants`, `CampaignRecipientsPreview`, `CampaignReportDialog` |
| `/email/reports` | `EmailReports` | Relatórios agregados (campanhas + automações) |
| `/email/segments` | `EmailSegments` (886 LOC) | CRUD de `email_segments` e `email_segment_contacts` |
| `/email/contacts` | `EmailContacts` | Import/export de contatos por segmento |
| `/email/queue` | `EmailQueue` | Inspeção de `email_queue` (pending/processing/failed) |
| `/email/logs` | `EmailLogs` | Timeline de `email_logs` com eventos Resend |
| `/email/unsubscribes` | `EmailUnsubscribes` | Lista de `email_unsubscribes` |
| `/settings/email` | `SettingsEmailDomain` + `DnsWizard` + `DomainHealthCard` | Provisionamento de domínio remetente |
| `/unsubscribe` (público) | `src/pages/Unsubscribe.tsx` | Página de opt-out (chama `email-unsubscribe`) |

`useEmailMetrics.ts` (70 LOC) — hook único que agrega counts de
`email_logs` por status + eventos JSONB (opened/clicked/bounced/complained).

## 2. Modelo de dados (17 tabelas)

Templates & assets: `email_templates`, `email_template_folders`.

Campanhas: `email_campaigns` (25 cols) + `email_campaign_variants` (14 cols,
A/B com peso). `scheduled_for` habilita disparo agendado.

Automações: `email_automations` (trigger_type + steps JSONB) +
`email_automation_enrollments` (leads inscritos, cursor por step).

Segmentação: `email_segments` (12 cols, filtros dinâmicos ou estáticos) +
`email_segment_contacts` (contatos avulsos ou espelhados de leads).

Envio / fila: `email_queue` (20 cols, status/priority/attempts/scheduled_at),
`email_send_state` (contador diário por clínica), `email_send_dedup`
(UNIQUE clinic+template+email+context — idempotência R-10),
`email_recipient_throttle` (janela 1h por dest_domain — R-13),
`email_domain_warmup` (cap diário por from_domain — R-12).

Domínios: `email_domains` (12 cols, status verified/partially_verified),
`clinic_email_integrations` (Resend key por clínica), `email_domain_warmup`.

Observabilidade: `email_logs` (20 cols, events JSONB por email individual),
`email_metrics_daily` (11 cols, agregado diário),
`email_health_alerts` + `email_operational_alerts` (alertas escalados).

Opt-out & webhooks: `email_unsubscribes`, `resend_webhook_events` (dedup
por svix-id — R-5).

## 3. Edge functions (11 no total)

### 3.1 `send-email` (491 LOC) — envio unitário

Fluxo obrigatório (ordem importa — cada gate pode reverter os anteriores):

1. **Auth** — service-role OU JWT super_admin OU owner/admin da clínica alvo.
2. **Feature gate** — `clinic_has_feature('email_marketing')` senão cancela.
3. **Template** (cache 60s em isolate) — precisa `active=true` e existir.
4. **Domain verify** (cache 60s) — `from_domain` precisa estar
   verified/partially_verified em `email_domains` (respeita
   `from_domain_override` para rotação R-21).
5. **Resend key resolve** — se clínica tem `clinic_email_integrations.enabled`
   usa a secret nomeada; senão cai para `RESEND_API_KEY` default.
6. **Suppression** — bloqueia se `email_unsubscribes` tem match
   (bypass com `force=true`).
7. **Dedup atômico** (R-10) — INSERT em `email_send_dedup`; se `23505`
   → `skipped: already_sent`. **Nunca** pula essa etapa em contexto real
   (`isInternalContext` retorna false).
8. **Cota diária** (R-11) — `claim_email_quota` RPC atômico. Se estourou,
   re-agenda para `12:00 UTC` do dia seguinte, remove dedup.
9. **Warm-up domain** (R-12) — `claim_domain_warmup`. Se estourou o cap
   diário do domínio, re-agenda em 30min, remove dedup, decrementa
   `email_send_state.sent_today`.
10. **Recipient throttle** (R-13) — `claim_recipient_throttle` limite
    1000/h por `dest_domain`. Pode ser desligado por clínica via
    `clinics.settings.email.throttle_recipient_enabled = false`. Ao falhar
    re-agenda para `window_start + 1h + 5s`.
11. **Unsubscribe token** — `generate_unsubscribe_token` RPC.
12. **Render** — `renderTemplate` faz `{{var}}` substitution. `subject_override`
    permite A/B (via `email_campaign_variants`).
13. **UTM tagging** (`addUtmsToHtml`) — injeta `utm_source=email`,
    `utm_medium=email`, `utm_campaign=<template>`, `utm_content=<template>`,
    `utm_term=<variant_id?>` em todo `<a href>` http(s), pulando
    unsubscribe/mailto/tel/anchors.
14. **Resend POST** — inclui `List-Unsubscribe` header + tags
    `template`/`category`/`clinic`. Falha → grava `status=failed` em
    `email_logs`, libera dedup, decrementa cota e warm-up.
15. **Success** — insere `email_logs status=sent` com `resend_id`,
    atualiza dedup com `resend_id` para auditoria.

### 3.2 `send-email-batch` (342 LOC) — Resend Batch API (R-15)

Requer service-role. Recebe até 100 jobs do MESMO `clinic_id +
template_slug`. Faz dedup/quota/warmup/throttle **antes** do batch;
quem falha é re-enfileirado individualmente. Chamada por
`process-email-queue` quando ≥ `BATCH_GROUP_MIN=2` jobs do mesmo par
estão pending.

### 3.3 `process-email-queue` (258 LOC) — worker principal

- Reaper: `processing > 10min` volta para `pending`.
- Ordem: `priority ASC` (1=auth/urgente, 5=padrão, 9=baixa) → `scheduled_at ASC`.
- **BATCH_SIZE=1000**, **CONCURRENCY=5**, **BATCH_PARALLELISM=5×100**
  (Tier 4 — Resend permite 5 req/s por team).
- Se ≥ `BATCH_GROUP_MIN=2` jobs mesmo clinic+template → `send-email-batch`;
  senão `send-email` em paralelo.
- Bulk-update final: 1 query por status (sent/failed_terminal/rescheduled).
- Classificação de erro:
  - **Permanente** (`not found`, `invalid to`, `not verified`) → `failed`
    definitivo mesmo antes de `MAX_ATTEMPTS=3`.
  - **Quota** → reagenda 09:00 BRT amanhã.
  - **Rate limit** (com `Retry-After`) → respeita header.
- Self-trigger: se drenou ≥ `SELF_TRIGGER_THRESHOLD=100` jobs, dispara
  outro tick imediato.

### 3.4 `dispatch-campaign` (338 LOC)

Trigger UI ou service-role. Resolve `email_segments` → produz lista de
recipients → enfileira em `email_queue` marcando `campaign_id` +
`variant_id` (para A/B testa `email_campaign_variants` com peso).
`test_only`/`test_email_override` para preview.

### 3.5 `process-scheduled-campaigns` (44 LOC)

Cron 5min. `email_campaigns WHERE status='scheduled' AND scheduled_for <= now()`
→ chama `dispatch-campaign` por campanha.

### 3.6 `email-automations-tick` (327 LOC)

Cron 5min. Para cada `email_automations` ativa:

- Cursor `last_run_at` (para automações NOVAS o cursor arranca em `now()`,
  senão re-enrolaria leads antigos).
- Triggers: `lead_created`, `lead_stage_changed`, `lead_tag_added`,
  `segment_contact_added`.
- Enrola em `email_automation_enrollments` e enfileira TODOS os steps
  em `email_queue` com `scheduled_at = now + step.delay_minutes`.
- Suppression/dedup/cota/domínio ficam por conta do `send-email`.
- **CONCURRENCY=10** automações em paralelo (semáforo simples — R-9).

### 3.7 `email-domain-manage` (218 LOC)

Super admin apenas. Actions: `create | verify | delete`. Faz proxy para a
Resend Domains API e atualiza `email_domains`.

### 3.8 `email-unsubscribe` (60 LOC)

Público. Valida token (HMAC) e insere em `email_unsubscribes`.
Chamado pela `src/pages/Unsubscribe.tsx`.

### 3.9 `resend-webhook` (99 LOC)

Webhook oficial. **Rejeita se `RESEND_WEBHOOK_SECRET` não estiver setado.**
Valida assinatura Svix. Dedup por `svix-id` (R-5). Atualiza `email_logs`
buscando pelo `resend_id` — inclui evento em `events` JSONB
(delivered/opened/clicked/bounced/complained) e ajusta `status` quando
bounce/complaint.

### 3.10 `backfill-resend-events` (85 LOC)

Utilitário admin: pega `resend_webhook_events` que não conseguiram casar
com `email_logs` e retenta associação (útil quando `resend_id` chega
depois do webhook).

### 3.11 `outreach-recovery-tick` (311 LOC) — cohorts diárias

Cron 04:00 BRT. Mantém 3 cohorts (`audit:b22_form_no_outreach`,
`audit:b23_hot_leads_buried`, `audit:b28_no_initial_outreach`) sincronizadas
como tag em `leads.tags` + row em `email_segment_contacts` (idempotente).
Alimenta automações via triggers `lead_tag_added` e `segment_contact_added`.
Cap `MAX_PER_COHORT=2000` por clínica.

## 4. Regras deterministas (R-*)

| ID | Regra | Implementação |
|---|---|---|
| **R-5** | Dedup de webhook Resend | `resend-webhook` INSERT em `resend_webhook_events` UNIQUE svix-id |
| **R-7** | Prioridade na fila | `email_queue.priority ASC` (1=auth, 5=default, 9=low) |
| **R-9** | Automações em paralelo | Semáforo `CONCURRENCY=10` em `email-automations-tick` |
| **R-10** | Idempotência de envio | `email_send_dedup` UNIQUE(clinic, template, email, context) |
| **R-11** | Cota diária por clínica | `claim_email_quota` RPC atômico, backoff 12h UTC |
| **R-12** | Warm-up de domínio | `claim_domain_warmup`, cap diário em `email_domain_warmup` |
| **R-13** | Throttle por domínio destinatário | `claim_recipient_throttle` 1000/h, opt-out por clínica |
| **R-15** | Batch API Resend | `send-email-batch` até 100 jobs mesmo clinic+template |
| **R-21** | Rotação multi-domain | `from_domain_override` em send-email/batch preservando local-part |

## 5. Contratos frágeis / invariantes

- **Nunca** pule `email_send_dedup` para envios de leads reais.
  `isInternalContext(related_lead_table)` decide (`leads_internal`,
  `quick_test_*`, `campaign_test_*` são internos).
- **Nunca** envie sem checar `email_domains.status`. Domínio não verificado
  → 412 e `email_queue.status='failed'`.
- **Nunca** remova o `List-Unsubscribe`/`List-Unsubscribe-Post` do
  `send-email` — Gmail/Yahoo exigem para bulk sender compliance.
- `resend-webhook` **exige** `RESEND_WEBHOOK_SECRET` — sem ele, webhook
  rejeita 401. Não silencie.
- `email_send_state.sent_today` é decrementado quando envio falha
  ou é bloqueado por warm-up/throttle DEPOIS do claim de cota.
  Não altere a ordem dos gates 8→9→10 sem revisar os `release`.
- A rotação de domínio (R-21) precisa preservar o `local-part` do
  `from_email` — bug conhecido se você substituir a string toda.
- `outreach-recovery-tick` idempotência depende do prefixo `audit:*` em
  tags. Renomear tag quebra a remoção quando lead sai do cohort.
- `email-automations-tick` de automação nova arranca em `now()`; ligar
  uma automação NÃO deve enrolar leads históricos.

## 6. Debug / operações

- **Fila travada**: `EmailQueue` mostra `processing > 10min` → o reaper
  do `process-email-queue` devolve para pending em ≤ 5min (cron).
- **Envio não sai**: cheque em ordem — feature flag, domínio verified,
  cota diária, warm-up cap, throttle recipient, `RESEND_API_KEY`.
- **Bounce/complaint alto**: `email_health_alerts` +
  `email_operational_alerts` — reduza warm-up cap manualmente.
- **A/B em campanha**: `email_campaign_variants.weight` determina
  distribuição; `send-email` recebe `variant_id` + `subject_override` e
  loga em `email_logs.variant_id`.
- **Backfill de webhook**: se `resend_id` chegou tarde, rode
  `backfill-resend-events` para re-vincular eventos órfãos.

## 7. Diretório

- `src/pages/email/*` — 13 páginas + `EmailHub` shell.
- `src/components/email/*` — 8 componentes (dialogs, badge, pager,
  DNS wizard, recipient preview).
- `src/components/email/editor/` — sub-módulo do editor de template.
- `src/components/email/live/` — preview live.
- `src/pages/Unsubscribe.tsx` — página pública de opt-out.
- `supabase/functions/_shared/email.ts` (39 LOC) — `corsHeaders`,
  `jsonResponse`, `renderTemplate`, `sanitizeTagValue`, `isInternalContext`.

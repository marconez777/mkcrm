# Sync completo da documentação de email campaigns

Objetivo: alinhar `docs/integrations/RESEND.md`, `docs/edge-functions/EMAIL.md`, `docs/flows/EMAIL_CAMPAIGN.md` e `docs/roadmap/EMAIL_SCALE.md` com o código real (pós Tier 0/1/2/3 e R-20 A/B).

## 1. `docs/integrations/RESEND.md` — críticos

- **Webhook**: remover menção a `INSERT email_events` e `UPDATE email_recipients` (tabelas não existem). Substituir pelo fluxo real: dedup em `resend_webhook_events` (svix-id) → update em `email_logs` (append `events[]`, status, `delivered_at/opened_at/clicked_at/bounced_at/complained_at`) → bounce hard/complaint upserta `email_unsubscribes`.
- **Tracking open/click**: remover claim de pixel customizado e rewrite de `<a href>` pelo `send-email`. Documentar real: `send-email` só aplica UTMs; open/click vêm do tracking nativo do Resend via webhook.
- **Domínio não verificado**: corrigir — retorna **412** (não fallback para domínio compartilhado).
- Atualizar "Pegadinhas" e remover sugestão de svix SDK (já é svix oficial).

## 2. `docs/edge-functions/EMAIL.md` — alto impacto

- **§3.1 `send-email` pipeline**: reescrever para refletir arquitetura atual:
  - Idempotência via `email_send_dedup` (INSERT ON CONFLICT) — R-10
  - Quota via RPC `claim_email_quota` (não leitura direta de `email_send_state`) — R-11
  - Warmup de domínio (R-12) com `email_domain_warmup`
  - Throttle por destinatário (R-13) com `email_recipient_throttle`
- **§10 A/B test**: remover "não há A/B nativo". Documentar R-20: `email_campaign_variants`, `variant_strategy` em `email_campaigns`, função `pick_ab_winner`, colunas `winner_picked_at`/`is_winner`.
- **§11 throughput**: corrigir `BATCH_SIZE=400`, `CONCURRENCY=2`; revisar estimativa de envios/h.
- **Tabelas**: adicionar seção/menção a `email_send_dedup`, `email_domain_warmup`, `email_recipient_throttle`, `email_campaign_variants`, `resend_webhook_events`, `clinic_email_integrations`.
- **`email-automations-tick`**: adicionar trigger `segment_contact_added`.
- **Nova edge function `send-email-batch`** (Resend Batch API, R-15): documentar como caminho principal de envio de campanhas, diferenças vs `send-email` unitário.
- **Reaper** em `process-email-queue` para jobs travados (stuck > N min).

## 3. `docs/flows/EMAIL_CAMPAIGN.md`

- Atores: adicionar `send-email-batch` como caminho principal de campanhas; `send-email` fica para automações/testes.
- Sequência: substituir o passo 5 do `send-email` ("idempotency em email_logs") por dedup em `email_send_dedup` + quota via `claim_email_quota`.
- Adicionar fluxo **pause/resume** (status `paused` + reaped).
- Nota sobre snapshot de audiência: mencionar `CampaignRecipientsPreview` no frontend.
- Aviso `email_events`/`email_recipients` já existe — manter, mas reforçar.

## 4. `docs/roadmap/EMAIL_SCALE.md`

- Marcar como ✅ os itens já implementados:
  - **R-3** self-trigger
  - **R-4** batch INSERT em `email_queue`
  - **R-5** dedup de webhook via `resend_webhook_events`
  - (validar R-10 a R-15, R-20 já marcados; ajustar se faltar)

## 5. Features de UI não documentadas (adicionar em `docs/edge-functions/EMAIL.md` ou referenciar `docs/frontend/PAGES.md`)

- `EmailCampaigns.tsx`: botão **Duplicate**, **Pause/Resume**, `from_name_override`, `CampaignLiveDialog`, `CampaignRecipientsPreview`.
- Listar em "Frontend" ou seção dedicada de UI da campanha.

## Detalhes técnicos

- Validação pós-edit: reler cada doc atualizado e cruzar com:
  - `supabase/functions/send-email/index.ts`
  - `supabase/functions/send-email-batch/index.ts`
  - `supabase/functions/process-email-queue/index.ts`
  - `supabase/functions/resend-webhook/index.ts`
  - `supabase/functions/email-automations-tick/index.ts`
  - `src/pages/email/EmailCampaigns.tsx`
- Manter formato/estilo existente dos docs (PT-BR, tabelas, blocos `text` para diagramas, "Última atualização: 2026-05-27").
- Não tocar em `docs/roadmap/EMAIL.md` (é só sobre auth emails).

## Entregáveis

4 arquivos editados:
1. `docs/integrations/RESEND.md`
2. `docs/edge-functions/EMAIL.md`
3. `docs/flows/EMAIL_CAMPAIGN.md`
4. `docs/roadmap/EMAIL_SCALE.md`

Sem alterações de código de aplicação ou schema.
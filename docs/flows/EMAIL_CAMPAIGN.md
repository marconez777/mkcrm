# Fluxo: Email Campaign (envio em massa de email)

> **Quando ler:** antes de mexer em campanhas de email, fila de processamento, webhook do Resend ou unsubscribe.
> **Última atualização:** 2026-05-27

---

## Atores

- **Frontend** página `EmailCampaigns` (criação/agendamento/pause/resume/duplicate, `CampaignRecipientsPreview`, `CampaignLiveDialog`).
- **Edge function** `dispatch-campaign` (resolve audiência, aplica rotation de domínio, A/B variant assignment, e enfileira em lote).
- **Edge function** `process-scheduled-campaigns` (cron — dispara campanhas agendadas).
- **Edge function** `process-email-queue` (cron — drena a fila, agrupa para Batch API).
- **Edge function** `send-email-batch` (envio em lote — **caminho principal de campanhas**, Resend Batch API até 100 por chamada).
- **Edge function** `send-email` (envio unitário — automações, teste e fallback do batch).
- **Edge function** `resend-webhook` (eventos de entrega/abertura/click/bounce).
- **Resend API** (provedor, chamada direta — sem gateway).
- **Postgres**: `email_campaigns`, `email_campaign_variants`, `email_queue`, `email_logs`, `email_send_dedup`, `email_unsubscribes`, `email_send_state`, `email_domain_warmup`, `email_recipient_throttle`, `resend_webhook_events`.

> ⚠️ **Não existem** tabelas `email_recipients` nem `email_events`. A fila é `email_queue`; o histórico/eventos vivem em `email_logs` (`events[]` + colunas `delivered_at`, `opened_at`, `clicked_at`, etc.); dedup de webhook é em `resend_webhook_events`.

---

## Sequência

```text
Usuário cria campanha em EmailCampaigns
        │ (template_slug, segmento opcional, scheduled_for?, variant_strategy?,
        │  from_name_override?, from_domain_pool?, send_rate_per_minute?)
        ▼
INSERT email_campaigns(status='draft' | 'scheduled')
        │  + (opcional) email_campaign_variants
        │
        ▼  (se scheduled_for definido)
cron 5min: process-scheduled-campaigns
        │ pega status='scheduled' AND scheduled_for <= now() (limit 20)
        │ chama dispatch-campaign(campaign_id)
        ▼
dispatch-campaign
        │ carrega segmento (filtros JSON; aceita tags/stage_ids/last_message_at_range/
        │   deal_value_range/custom_field) com paginação por 1k
        │ para cada destinatário:
        │   • pick A/B variant (round-robin ponderado determinístico por email) — R-20
        │   • pick rotation domain (RPC pick_rotation_domain) — R-21
        │   • calcula scheduled_at (espalha por janelas de 1min se send_rate_per_minute) — R-18
        │ INSERT em lote em email_queue (chunks de 500) — R-4
        │ UPDATE email_campaigns(status='sending'|'sent', total_recipients, enqueued_count, sent_at)
        │ status='paused' pausa o dispatch (pause/resume via UI)
        ▼
cron ~15s: process-email-queue
        │ reaper: jobs em 'processing' há >10min voltam para 'pending'
        │ pega até 400 jobs pending (ORDER BY priority ASC, scheduled_at ASC) — R-7
        │ marca 'processing'
        │ agrupa por (clinic_id, template_slug, from_domain_override)
        │   • grupo com ≥3 jobs → send-email-batch (Resend Batch API) — R-15
        │   • grupos menores → send-email singular (CONCURRENCY=2)
        │ self-trigger se ainda há pending (R-3)
        ▼
send-email-batch / send-email
        │ 1. feature gate (clinic_has_feature 'email_marketing')
        │ 2. carrega template ativo por (clinic, slug) [cache 60s — R-6]
        │ 3. resolve domínio efetivo (from_domain_override aplicado, preservando local-part)
        │ 4. checa email_domains.status='verified' (412 se não)
        │ 5. suppression check em email_unsubscribes (a menos que force=true)
        │ 6. idempotência atômica: INSERT ON CONFLICT em email_send_dedup — R-10
        │ 7. cota: RPC claim_email_quota (UPSERT atômico, reset diário) — R-11
        │    quota estourada → reagenda 12:00 UTC do dia+1
        │ 8. warmup: RPC claim_domain_warmup (curva 50→100→500→1k→…) — R-12
        │    estourado → reagenda +30min, libera dedup
        │ 9. throttle por domínio destino: RPC claim_recipient_throttle (1000/h) — R-13
        │    estourado → reagenda próxima janela horária, libera dedup
        │10. gera unsubscribe_url (HMAC) + render de variáveis
        │11. POST Resend (/emails ou /emails/batch)
        │12. INSERT email_logs(status='sent', resend_id, variant_id, from_domain_override)
        │13. falha → DELETE email_send_dedup (libera reenvio) + release warmup/throttle
        ▼
process-email-queue atualiza email_queue:
        │ sucesso → status='sent'
        │ erro permanente (not_found, invalid_to, not_verified) → 'failed' sem retry
        │ rate limit → reagenda com Retry-After + 1s
        │ quota/warmup/throttle estourados → reagenda conforme política acima
        │ outros → backoff 1min → 5min → 30min (até 3 tentativas)
        ▼
[Resend entrega]
        │
        ▼
resend-webhook (delivered, opened, clicked, bounced, complained)
        │ valida assinatura Svix (RESEND_WEBHOOK_SECRET) via svix SDK
        │ INSERT resend_webhook_events(svix_id PK) — dedup R-5
        │ encontra email_logs por resend_id
        │ append em events[] + atualiza colunas *_at + status
        │ bounce hard / complaint → upsert email_unsubscribes
        │ trigger email_logs_bounce_health_trigger → check_clinic_bounce_health
        │   bounce_rate>5% ou complaint_rate>0.3% → pausa campanhas + email_health_alerts — R-16
```

---

## Pause / Resume / Duplicate

- **Pausar**: UI muda `email_campaigns.status` para `'paused'`. `process-email-queue` continua processando jobs já enfileirados (não há cancelamento retroativo automático nessa versão); para parar enfileiramento futuro, o status `paused` bloqueia `dispatch-campaign` em campanhas ainda não totalmente despachadas.
- **Retomar**: status volta para `scheduled` ou `sending`.
- **Duplicar**: botão na tabela copia template_slug, segmento, variants e configurações de envio, criando nova campanha em `draft`.

---

## Teste rápido

`EmailCampaigns` tem botão de **enviar teste** (campo `test_email`, `test_sent_at`). Chama `dispatch-campaign { test_only: true, test_email_override }` — pega 1 lead amostral do segmento para popular variáveis, enfileira com `force: true` e dispara `process-email-queue` imediatamente.

---

## A/B test (R-20)

- `email_campaigns.variant_strategy = 'none' | 'ab' | 'multi'`.
- `email_campaign_variants(label, weight, subject_override, template_slug_override, from_name_override, sent_count, opened_count, clicked_count, is_winner)`.
- `dispatch-campaign` aplica round-robin ponderado **determinístico por destinatário** (hash do email) → garante consistência se a campanha for re-disparada.
- `email_queue.variant_id` e `email_logs.variant_id` carregam a atribuição.
- RPC `pick_ab_winner(_campaign_id)` recalcula sent/opened/clicked por variante e marca `is_winner=true` por melhor taxa de abertura. `winner_picked_at` registra o momento.

---

## Unsubscribe

```text
Destinatário clica link no footer do email
        │
        ▼
GET /unsubscribe?clinic=&email=&token=
        │ (mount) edge email-unsubscribe { action: 'validate' }
        │ valida token via RPC verify_unsubscribe_token (HMAC)
        ▼
usuário clica "Confirmar descadastro"
        │
        ▼
edge email-unsubscribe { action: 'unsubscribe', reason }
        │ upsert email_unsubscribes(clinic_id, email, reason, source='user-link')
        │ CASCADE: UPDATE email_queue SET status='cancelled'
        │         WHERE clinic_id=? AND email=? AND status='pending' AND force_send=false
        ▼
opcional: { action: 'reactivate' } → DELETE email_unsubscribes WHERE clinic+email
```

Todo `send-email`/`send-email-batch` checa `email_unsubscribes` antes de chamar Resend.

---

## Throttle e proteção

- **Cron**: `process-email-queue` roda a cada ~15s (cron + self-trigger R-3).
- **Batch**: `BATCH_SIZE=400` jobs por execução; agrupados para Batch API quando possível.
- **Concorrência singular**: `CONCURRENCY=2` (respeita 2 req/s do Resend).
- **Cota diária por clínica**: RPC `claim_email_quota` (default 1000); estourou → reagenda 12 UTC do dia+1.
- **Rate limit Resend (429)**: parser de `Retry-After Xs|ms` reagenda com delay + 1s.
- **Warmup por domínio**: curva `50→100→500→1k→5k→10k→25k→ilimitado` por dia desde `started_at`. Opt-in via linha em `email_domain_warmup`.
- **Throttle por domínio destino**: 1000/h por `(clinic, dest_domain)` (R-13).
- **Health check automático**: bounce>5% ou complaint>0.3% nas últimas 1000 → pausa campanhas + alerta.
- **Bounces hard / complaints** viram `email_unsubscribes` automaticamente (via `resend-webhook`).

---

## Backfill / reconciliação

- `backfill-resend-events`: super admin. Pega até 200 `email_logs` com `resend_id` e `delivered_at IS NULL`, consulta `GET /emails/{id}` no Resend e atualiza status/timestamps. Bounces/complaints viram entries em `email_unsubscribes`.

---

## Pegadinhas

- **Tracking de open/click é do Resend**: pixel cacheado por proxies (Gmail) subestima opens. Não temos pixel próprio.
- **DKIM/SPF**: cada clínica usa domínio próprio (`email_domains`). Sem verificação completa, `send-email` retorna 412 e marca queue como `failed`. Checar `email-domain-manage` + `DnsWizard`.
- **Audiência "snapshot"**: ao chamar `dispatch-campaign`, a lista é resolvida **naquele momento** (INSERT em `email_queue`). Leads criados depois **não** entram. UI mostra preview via `CampaignRecipientsPreview`.
- **Schedule no passado**: aceitamos — `process-scheduled-campaigns` envia na próxima execução do cron (até 5min).
- **Reenvio**: não há botão "reenviar para quem não abriu". Criar nova campanha com novo segmento (R-19 facilita com `custom_field`).
- **Idempotência atômica**: `email_send_dedup` UNIQUE `(clinic, slug, email, context)`. `related_lead_table` interno (`leads_internal`, `quick_test_*`, `campaign_test_*`) **não** deduplica.
- **Pause não cancela jobs já enfileirados**: drena o que está em `email_queue` mesmo com a campanha pausada. Para travar de verdade, usar `force_send=false` + remover destinatários do segmento, ou apagar jobs pendentes manualmente.
- **Batch API**: se a chamada batch falha por completo, o `send-email-batch` faz fallback automático para envios singulares dentro do mesmo invocation.

---

## Melhorias sugeridas

- UI para visualizar eventos por recipient (timeline) — hoje só vê em `EmailLogs`.
- Cancelamento retroativo de jobs ao pausar campanha (hoje só bloqueia novos).
- Reenvio "para quem não abriu" como ação nativa.

---

## Arquivos-chave

- `supabase/functions/dispatch-campaign/index.ts`
- `supabase/functions/process-scheduled-campaigns/index.ts`
- `supabase/functions/process-email-queue/index.ts`
- `supabase/functions/send-email-batch/index.ts`
- `supabase/functions/send-email/index.ts`
- `supabase/functions/resend-webhook/index.ts`
- `supabase/functions/email-unsubscribe/index.ts`
- `supabase/functions/backfill-resend-events/index.ts`
- `src/pages/email/EmailCampaigns.tsx`
- `src/components/email/CampaignRecipientsPreview.tsx`
- `src/components/email/live/CampaignLiveDialog.tsx`
- `docs/edge-functions/EMAIL.md`
- `docs/integrations/RESEND.md`
- `docs/roadmap/EMAIL_SCALE.md`

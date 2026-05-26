# Fluxo: Email Campaign (envio em massa de email)

> **Quando ler:** antes de mexer em campanhas de email, fila de processamento, webhook do Resend ou unsubscribe.
> **Última atualização:** 2026-05-26

---

## Atores

- **Frontend** página `EmailCampaigns` (criação/agendamento)
- **Edge function** `dispatch-campaign` (resolve audiência e enfileira)
- **Edge function** `process-scheduled-campaigns` (cron — dispara campanhas agendadas)
- **Edge function** `process-email-queue` (cron — drena a fila)
- **Edge function** `send-email` (envio unitário; chama Resend)
- **Edge function** `resend-webhook` (eventos de entrega/abertura/click/bounce)
- **Resend API** (provedor, chamada direta — sem gateway)
- **Postgres**: `email_campaigns`, `email_queue`, `email_logs`, `email_unsubscribes`, `email_send_state`

> ⚠️ **Não existem** tabelas `email_recipients` nem `email_events` no schema. A fila é `email_queue` e o histórico/eventos vivem em `email_logs` (com timestamps `delivered_at`, `opened_at`, `clicked_at`, etc.).

---

## Sequência

```text
Usuário cria campanha
        │ (template_slug, segmento opcional, scheduled_for?)
        ▼
INSERT email_campaigns(status='draft' | 'scheduled')
        │
        ▼  (se schedule_at definido)
cron pg_cron a cada 5min: process-scheduled-campaigns
        │ pega campaigns com scheduled_for <= now() AND status='scheduled' (limit 20)
        │ chama dispatch-campaign(campaign_id)
        ▼
dispatch-campaign
        │ carrega segment.filters do email_segments (se houver)
        │ query leads (clinic, email NOT NULL, stage_ids IN, tags overlaps, limit 10k)
        │ para cada lead → RPC enqueue_email(...) → INSERT email_queue(status='pending')
        │ UPDATE email_campaigns(status='sending'|'sent', total_recipients, enqueued_count, sent_at)
        ▼
cron pg_cron a cada 1min: process-email-queue
        │ pega até 50 jobs pending com scheduled_at <= now()
        │ marca como 'processing'
        │ para cada → HTTP send-email (service-role auth)
        ▼
send-email
        │ 1. feature gate (clinic_has_feature 'email_marketing')
        │ 2. carrega template ativo por (clinic, slug)
        │ 3. checa domínio verified em email_domains
        │ 4. suppression check em email_unsubscribes (a menos que force=true)
        │ 5. idempotency check em email_logs (por contexto externo)
        │ 6. cota diária via email_send_state (reagenda se estourar)
        │ 7. gera unsubscribe_url (HMAC) + render de variáveis
        │ 8. POST https://api.resend.com/emails (direto, Bearer RESEND_API_KEY)
        │ 9. INSERT email_logs(status='sent', resend_id, ...)
        │10. incrementa email_send_state.sent_today
        ▼
process-email-queue atualiza email_queue:
        │ sucesso → status='sent'
        │ erro permanente → status='failed' (sem retry)
        │ rate limit → reagenda com Retry-After + 1s
        │ quota estourada → reagenda 12:00 UTC do dia seguinte
        │ outros → backoff 1min → 5min → 30min (até 3 tentativas)
        ▼
[Resend entrega]
        │
        ▼
resend-webhook (eventos: delivered, opened, clicked, bounced, complained)
        │ valida assinatura Svix (RESEND_WEBHOOK_SECRET)
        │ encontra email_logs por resend_id
        │ append em events[] + atualiza colunas *_at + status
        │ bounce hard / complaint → upsert email_unsubscribes
```

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

Todo `send-email` checa `email_unsubscribes` antes de chamar Resend — recipient vira `cancelled` no `email_queue`.

---

## Throttle

- `process-email-queue` processa em lotes de 50 (`BATCH_SIZE`) por execução do cron (a cada 1min).
- Quota diária por clínica (`clinic_email_quota` RPC, default 1000) — estourou, jobs reagendam para 12:00 UTC do dia seguinte (~9h BRT).
- Rate limit do Resend (429): parser de `Retry-After Xs|ms` reagenda com delay + 1s.
- Bounces hard / complaints viram `email_unsubscribes` automaticamente (via `resend-webhook`).

---

## Backfill / reconciliação

- `backfill-resend-events`: super admin. Pega até 200 `email_logs` com `resend_id` e `delivered_at IS NULL`, consulta `GET /emails/{id}` no Resend e atualiza status/timestamps. Bounces/complaints viram entries em `email_unsubscribes`.

---

## Pegadinhas

- **Imagem do pixel cacheada**: alguns clients (Gmail proxy) baixam pixel **uma vez** mesmo se aberto N vezes → `opened` é subestimado. (Tracking de open é do Resend nativo.)
- **DKIM/SPF**: cada clínica usa domínio próprio (`email_domains`). Sem verificação completa, `send-email` retorna 412 e marca queue como `failed`. Checar `email-domain-manage` + `DnsWizard`.
- **Audiência "snapshot"**: ao chamar `dispatch-campaign`, a lista de recipients é resolvida **naquele momento** (insert em `email_queue`). Leads criados depois **não** entram (mesmo padrão de broadcasts WhatsApp).
- **Schedule no passado**: aceitamos — `process-scheduled-campaigns` envia na próxima execução do cron (até 5min).
- **Reenvio**: não há botão "reenviar para quem não abriu". Pra isso, criar nova campanha com novo segmento.
- **Idempotência**: `related_lead_table` define escopo. Tabelas internas (`leads_internal`, `quick_test_*`, `campaign_test_*`) não deduplicam. Qualquer outro valor → dedup por `(clinic, slug, email, table)` em `email_logs`.

---

## Melhorias sugeridas

- A/B test de assunto.
- Warmup automático de domínio novo.
- Limite por destinatário/dia (anti-spam interno).
- UI para visualizar eventos por recipient (timeline) — hoje só vê na `EmailLogs`.

---

## Arquivos-chave

- `supabase/functions/dispatch-campaign/index.ts`
- `supabase/functions/process-scheduled-campaigns/index.ts`
- `supabase/functions/process-email-queue/index.ts`
- `supabase/functions/send-email/index.ts`
- `supabase/functions/resend-webhook/index.ts`
- `supabase/functions/email-unsubscribe/index.ts`
- `supabase/functions/backfill-resend-events/index.ts`
- `docs/edge-functions/EMAIL.md`
- `docs/integrations/RESEND.md`

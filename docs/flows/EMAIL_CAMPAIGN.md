# Fluxo: Email Campaign (envio em massa de email)

> **Quando ler:** antes de mexer em campanhas de email, fila de processamento, webhook do Resend ou unsubscribe.
> **Última atualização:** 2026-05-25

---

## Atores

- **Frontend** página `EmailCampaigns` (criação/agendamento)
- **Edge function** `dispatch-campaign` / `process-email-queue` / `process-scheduled-campaigns`
- **Edge function** `send-email` (envio unitário, abstração sobre Resend)
- **Resend API** (provedor)
- **Edge function** `resend-webhook` (eventos de entrega/abertura/click/bounce)
- **Postgres**: `email_campaigns`, `email_recipients`, `email_events`, `email_unsubscribes`

---

## Sequência

```text
Usuário cria campanha
        │ (assunto, html, audiência via filtro/segmento, schedule_at)
        ▼
INSERT email_campaigns(status='scheduled')
INSERT email_recipients (snapshot da audiência, status='pending')
        │
        ▼
cron pg_cron a cada 1min: process-scheduled-campaigns
        │ pega campanhas com schedule_at <= now() AND status='scheduled'
        │ UPDATE status='running'
        │ chama dispatch-campaign(campaign_id)
        ▼
dispatch-campaign
        │ loop: pega lote de email_recipients (status='pending') LIMIT 50
        │ para cada → chama send-email(to, subject, html, headers tracking)
        │
        ▼
send-email
        │ valida unsubscribe (email_unsubscribes)
        │ injeta pixel + reescreve links com tracking
        │ POST Resend /emails
        │ UPDATE email_recipients(status='sent', resend_id)
        ▼
[Resend entrega]
        │
        ▼
resend-webhook (eventos: delivered, opened, clicked, bounced, complained)
        │ INSERT email_events
        │ UPDATE email_recipients (status, opened_at, clicked_at, ...)
        │
        ▼
quando todos recipients deixam 'pending' →
UPDATE email_campaigns(status='done', stats agregadas)
```

---

## Unsubscribe

```text
Destinatário clica "descadastrar" no footer
        │
        ▼
GET /email-unsubscribe?token=...
        │ valida token HMAC
        ▼
INSERT email_unsubscribes(email, clinic_id, reason='link')
mostra página de confirmação
```

Todo `send-email` checa `email_unsubscribes` antes de chamar Resend — recipient vira `status='skipped_unsubscribed'`.

---

## Throttle

- `dispatch-campaign` processa em lotes para não estourar quota Resend (10 req/s default).
- Há jitter entre lotes (200-500ms).
- Bounces hard (`status=bounced`) automaticamente adicionam o email a `email_unsubscribes(reason='hard_bounce')`.

---

## Backfill / reconciliação

- `backfill-resend-events`: roda manualmente. Consulta API Resend pra eventos perdidos pelo webhook (downtime).

---

## Pegadinhas

- **Imagem do pixel cacheada**: alguns clients (Gmail proxy) baixam pixel **uma vez** mesmo se aberto N vezes → `opened_count` é subestimado.
- **Click tracking quebra mailto:** e `tel:` — reescrita ignora esses schemes.
- **DKIM/SPF**: cada clínica pode usar domínio próprio (`email_domains`). Sem verificação completa, Resend retorna 422 → recipient vira `failed`. Checar `email-domain-manage`.
- **Audiência "snapshot"**: `email_recipients` é congelado na criação. Adicionar leads depois **não** os inclui (mesmo padrão de broadcasts WhatsApp).
- **Schedule no passado**: aceitamos — `process-scheduled-campaigns` envia imediatamente.
- **Reenvio**: não há botão "reenviar para quem não abriu". Pra isso, criar nova campanha com filtro `not_opened`.

---

## Melhorias sugeridas

- A/B test de assunto (`email_campaign_variants`).
- Warmup automático de domínio novo.
- Limite por destinatário/dia (anti-spam interno).
- UI para visualizar `email_events` por recipient (timeline).

---

## Arquivos-chave

- `supabase/functions/dispatch-campaign/index.ts`
- `supabase/functions/process-email-queue/index.ts`
- `supabase/functions/process-scheduled-campaigns/index.ts`
- `supabase/functions/send-email/index.ts`
- `supabase/functions/resend-webhook/index.ts`
- `supabase/functions/email-unsubscribe/index.ts`
- `edge-functions/EMAIL.md`
- `integrations/RESEND.md`

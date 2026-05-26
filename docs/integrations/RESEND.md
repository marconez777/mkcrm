# Integração: Resend (Email)

> **Quando ler:** antes de mexer em envio de email, verificação de domínio, webhook de eventos, ou tracking de open/click.
> **Última atualização:** 2026-05-26

---

## O que é

Resend é o provedor SMTP/API que entrega os emails. Cada clínica pode usar um domínio próprio (`email_domains`) ou cair no domínio default da plataforma.

---

## Secrets

| Nome | Uso |
|---|---|
| `RESEND_API_KEY` | autenticação direta na API Resend (`Authorization: Bearer ...`) |
| `RESEND_WEBHOOK_SECRET` | valida assinatura Svix dos webhooks |

A integração chama **a API pública do Resend direto** (`https://api.resend.com`). Não usa o connector gateway Lovable — não há `LOVABLE_API_KEY` envolvido no fluxo de email.

---

## Endpoints usados

| Edge function | Endpoint | Método |
|---|---|---|
| `send-email` | `https://api.resend.com/emails` | POST |
| `email-domain-manage` | `https://api.resend.com/domains`, `/domains/{id}/verify`, `/domains/{id}` | POST/GET/DELETE |
| `resend-webhook` | (recebe webhook do Resend) | POST |
| `backfill-resend-events` | `https://api.resend.com/emails/{id}` | GET (reconciliação) |

---

## Domínios

- Cada clínica configura subdomínio (ex.: `mail.minhaclinica.com.br`) em **Settings → Email**.
- `email-domain-manage('create')` cria no Resend e retorna registros DNS (DKIM, SPF, return-path).
- Usuário adiciona DNS → `email-domain-manage('verify')` confere → `email_domains.status='verified'`.
- Só domínios verificados podem ser usados em `from:`. Senão, fallback para o domínio compartilhado.

---

## Webhook (eventos)

URL: `https://<project>.functions.supabase.co/resend-webhook`
Eventos assinados:
- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced` (hard/soft)
- `email.complained` (spam)
- `email.opened`
- `email.clicked`

Validação: header `svix-signature` (HMAC-SHA256 com `RESEND_WEBHOOK_SECRET`).

Para cada evento:
1. INSERT em `email_events`
2. UPDATE `email_recipients` (status + timestamp)
3. Em `bounced` hard / `complained` → INSERT `email_unsubscribes`

Ver `flows/EMAIL_CAMPAIGN.md`.

---

## Tracking de open/click

- **Open**: pixel 1x1 injetado pelo `send-email` (URL `/tracking-pixel?eid=...`). Resend **também** tem tracking nativo — usamos o nosso para granularidade por recipient.
- **Click**: `send-email` reescreve `<a href>` para `/tracking-event?eid=...&u=<encoded>`. Faz redirect 302.

---

## Pegadinhas

- **Domínio não verificado**: Resend retorna 422. UI deve mostrar "verifique o domínio antes de enviar".
- **From inválido**: precisa ser `Nome <email@dominio-verificado>` — sem aspas em `Nome`.
- **Rate limit Resend**: 10 req/s (free) / mais nos planos pagos. `dispatch-campaign` respeita via batch.
- **Webhook duplicado**: Resend pode reentregar. Usar `event_id` (svix-id) UNIQUE em `email_events`.
- **HTML pesado (>100KB)**: Gmail clipa. Usar template enxuto.
- **Imagens hospedadas no Storage**: precisam estar em bucket público OU URL assinada longa. Senão, viram quadradinhos.
- **Reply-To**: se não setado, replies vão para o `from:` (no-reply). Para conversas, setar `reply_to: clinic.support_email`.
- **DKIM mismatch**: erro silencioso — entrega na caixa de spam. Sempre verificar com `mail-tester.com` ao subir novo domínio.

---

## Melhorias sugeridas

- Warmup automático de domínio novo (envio gradual nas primeiras 2 semanas).
- Dashboard de "saúde de domínio" (taxa de bounce/spam por dia).
- Migrar webhook validation para svix SDK oficial.

---

## Arquivos-chave

- `supabase/functions/send-email/index.ts`
- `supabase/functions/resend-webhook/index.ts`
- `supabase/functions/email-domain-manage/index.ts`
- `supabase/functions/backfill-resend-events/index.ts`
- `edge-functions/EMAIL.md`
- `flows/EMAIL_CAMPAIGN.md`

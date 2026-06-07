---
title: "Integração: Resend (Email)"
topic: email
kind: reference
audience: agent
updated: 2026-06-07
summary: Resend é o provedor SMTP/API que entrega os emails. Cada clínica configura **um ou mais domínios próprios** em `email_domains` (verificação via Resend). Não existe fallback automático para domínio compartilhado — sem domínio verificado o en
---
# Integração: Resend (Email)

> **Quando ler:** antes de mexer em envio de email, verificação de domínio, webhook de eventos, ou tracking de open/click.
> **Última atualização:** 2026-05-27

---

## O que é

Resend é o provedor SMTP/API que entrega os emails. Cada clínica configura **um ou mais domínios próprios** em `email_domains` (verificação via Resend). Não existe fallback automático para domínio compartilhado — sem domínio verificado o envio é bloqueado.

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
| `send-email-batch` | `https://api.resend.com/emails/batch` | POST (até 100 por chamada) |
| `email-domain-manage` | `https://api.resend.com/domains`, `/domains/{id}/verify`, `/domains/{id}` | POST/GET/DELETE |
| `resend-webhook` | (recebe webhook do Resend) | POST |
| `backfill-resend-events` | `https://api.resend.com/emails/{id}` | GET (reconciliação) |

---

## Domínios

- Cada clínica configura subdomínio (ex.: `mail.minhaclinica.com.br`) — criação é feita por **super admin** via `email-domain-manage`.
- `email-domain-manage('create')` cria no Resend e retorna registros DNS (DKIM, SPF, return-path).
- Usuário adiciona DNS → `email-domain-manage('verify')` confere → `email_domains.status='verified'`.
- Apenas domínios com `status='verified'` podem ser usados no `from:`. Sem domínio verificado, `send-email` retorna **412** e o job vai para `failed`.
- **Multi-domínio rotativo (R-21):** `email_domains` tem `rotation_pool` + `rotation_weight`. Campanha define `email_campaigns.from_domain_pool`; `dispatch-campaign` chama RPC `pick_rotation_domain` por destinatário e grava em `email_queue.from_domain_override`. `send-email`/`send-email-batch` aplicam o override preservando o local-part.

---

## Webhook (eventos)

URL: `https://<project>.functions.supabase.co/resend-webhook`

Eventos consumidos (atualizam `email_logs`):
- `email.delivered`
- `email.opened`
- `email.clicked`
- `email.bounced`
- `email.complained`

(`email.sent` e `email.delivery_delayed` chegam mas não geram update específico — vão para `events[]` apenas.)

Validação: header `svix-signature` (HMAC-SHA256 com `RESEND_WEBHOOK_SECRET`), via **svix SDK oficial** (`npm:svix`). Sem secret configurado, o webhook aceita unsigned (apenas dev).

Para cada evento, o fluxo real é:

1. **Dedup por `svix-id`** → INSERT em `resend_webhook_events(svix_id PK, event_type, resend_id)`. Conflito (`23505`) = evento repetido, retorna `{ deduped: true }` sem reprocessar (R-5).
2. **Encontra `email_logs`** por `resend_id` (1:1).
3. **Append em `email_logs.events[]`** + atualiza `status` + coluna timestamp (`delivered_at`, `opened_at`, `clicked_at`, `bounced_at`, `complained_at`).
4. **Bounce hard / Permanent** ou **complaint** → `upsert email_unsubscribes (reason: 'bounce' | 'complaint', source: 'resend-webhook')` com `onConflict: 'clinic_id,email'`.

> ⚠️ **Não existem** tabelas `email_events` nem `email_recipients`. O histórico/eventos vivem todos em `email_logs.events[]` (JSON) + colunas dedicadas, e a dedup de webhook é em `resend_webhook_events`.

---

## Tracking de open/click

- **Open**: tracking nativo do Resend (pixel injetado pela plataforma deles). Não há pixel próprio.
- **Click**: tracking nativo do Resend (rewrite de URLs no provedor). Não há rewriter próprio.
- O que o `send-email` faz com links é **anexar UTMs** (utm_source/medium/campaign) — não substitui o domínio nem injeta endpoint próprio de tracking.
- O endpoint `/tracking-pixel` existe no projeto mas pertence ao módulo de tracking de **site/leads**, não de email.

---

## Pegadinhas

- **Domínio não verificado**: Resend recusa (422) e o `send-email` devolve **412**. Job vai para `failed` sem retry. UI deve guiar o usuário ao `DnsWizard`.
- **From inválido**: precisa ser `Nome <email@dominio-verificado>` — sem aspas em `Nome`.
- **Rate limit Resend**: 2 req/s padrão (free) / mais nos planos pagos. `process-email-queue` roda com `CONCURRENCY=2` no caminho singular para respeitar isso; `send-email-batch` reduz drasticamente o número de chamadas em campanhas.
- **Webhook duplicado**: Resend pode reentregar. Dedup atômico via `resend_webhook_events.svix_id` (PK).
- **HTML pesado (>100KB)**: Gmail clipa. Usar template enxuto.
- **Imagens hospedadas no Storage**: precisam estar em bucket público OU URL assinada longa. Senão, viram quadradinhos.
- **Reply-To**: se não setado, replies vão para o `from:` (no-reply). Para conversas, setar `reply_to: clinic.support_email`.
- **DKIM mismatch**: erro silencioso — entrega na caixa de spam. Sempre verificar com `mail-tester.com` ao subir novo domínio.
- **Multi-domínio + Batch**: `process-email-queue` agrupa jobs por `(clinic_id, template_slug, from_domain_override)` para que cada chamada de batch mantenha um `From` consistente.

---

## Melhorias sugeridas

- Warmup automático mais granular (curva por reputação observada, não só dias).
- Dashboard de "saúde de domínio" exposto ao admin da clínica (hoje vive em `email_health_alerts` / `email_operational_alerts`).

---

## Arquivos-chave

- `supabase/functions/send-email/index.ts`
- `supabase/functions/send-email-batch/index.ts`
- `supabase/functions/process-email-queue/index.ts`
- `supabase/functions/resend-webhook/index.ts`
- `supabase/functions/email-domain-manage/index.ts`
- `supabase/functions/backfill-resend-events/index.ts`
- `docs/edge-functions/EMAIL.md`
- `docs/flows/EMAIL_CAMPAIGN.md`

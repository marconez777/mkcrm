---
title: "IntegraÃ§Ãµes externas â€” Resend, Meta, Google, Stripe, Evolution, Eduzz"
topic: integracao
kind: map
audience: agent
updated: 2026-07-01
summary: "Mapa unificado das integraÃ§Ãµes externas do Chat Funnel AI: Evolution API (WhatsApp), Stripe via connector gateway, Resend (via Lovable Emails + webhook Svix), Eduzz (webhook pÃºblico de vendas), Meta (roadmap), Google (BYOK Gemini). Cobre autenticaÃ§Ã£o, endpoints, segredos, dedup e invariantes."
code_refs:
  - supabase/functions/_shared/evolution.ts
  - supabase/functions/_shared/stripe.ts
  - supabase/functions/_shared/email.ts
  - supabase/functions/evolution-webhook/
  - supabase/functions/evolution-provision/
  - supabase/functions/evolution-send/
  - supabase/functions/evolution-send-media/
  - supabase/functions/evolution-qr/
  - supabase/functions/evolution-logout/
  - supabase/functions/evolution-restart/
  - supabase/functions/evolution-delete-instance/
  - supabase/functions/evolution-health/
  - supabase/functions/evolution-collect-leads/
  - supabase/functions/evolution-backfill-all/
  - supabase/functions/evolution-fetch-groups/
  - supabase/functions/evolution-sync-lead/
  - supabase/functions/evolution-test/
  - supabase/functions/eduzz-webhook/
  - supabase/functions/resend-webhook/
  - supabase/functions/backfill-resend-events/
  - supabase/functions/payments-webhook/
  - supabase/functions/pipeline-payment-webhook/
related_docs:
  - docs/evolution/WHATSAPP.md
  - docs/evolution/EVOLUTION_EDGES.md
  - docs/maps/BILLING.md
  - docs/maps/EMAIL_MARKETING.md
  - docs/maps/STORAGE_UPLOADS.md
---

# IntegraÃ§Ãµes externas

Este mapa Ã© o **Ã­ndice Ãºnico** das integraÃ§Ãµes externas com terceiros. Cada
seÃ§Ã£o lista provedor, segredos, superfÃ­cies de entrada/saÃ­da e invariantes.
Detalhes profundos ficam nos mapas especÃ­ficos (`EVOLUTION_EDGES.md`,
`WHATSAPP.md`, `BILLING.md`, `EMAIL_MARKETING.md`).

## 1. Evolution API (WhatsApp nÃ£o-oficial)

**Provedor:** instÃ¢ncia prÃ³pria/gerenciada da Evolution API v2.

**Segredos runtime:**
- `EVOLUTION_GLOBAL_URL` â€” base URL da instÃ¢ncia global (sem barra final).
- `EVOLUTION_GLOBAL_API_KEY` â€” chave admin para provisionar/deletar instÃ¢ncias.
- Por instÃ¢ncia (persistidos em `public.whatsapp_instances`): `evolution_api_key`, `webhook_token` (nÃ£o legÃ­veis por `authenticated`, apenas `service_role`).

**SuperfÃ­cies (18 edge functions):** todas usam `_shared/evolution.ts` (`sb()`, `json`, `requireUser`, `ingestMessage`, `downloadAndStoreMedia`, `loadInstanceByToken`).

| FunÃ§Ã£o                         | Papel                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `evolution-provision`          | Cria instÃ¢ncia na Evolution + linha em `whatsapp_instances`. Requer clinic member ou super admin. |
| `evolution-qr`                 | Retorna QR code base64 para pareamento inicial.                                                 |
| `evolution-restart`, `evolution-logout`, `evolution-delete-instance` | Ciclo de vida da instÃ¢ncia.                                             |
| `evolution-health`             | Ping/status. Usado por `AdminPipelineHealth` e monitor interno.                                 |
| `evolution-webhook`            | **Entrada Ãºnica de eventos.** Autenticada por `?token=<webhook_token>` (query param), nÃ£o JWT. Dedup por `webhook_events` + `webhook_dedup`. |
| `evolution-send`, `evolution-send-media` | Envio outbound de texto/mÃ­dia. Usados por Composer e Broadcasts.                    |
| `evolution-collect-leads`, `evolution-backfill-all`, `evolution-fetch-groups`, `evolution-sync-lead` | Backfill de histÃ³rico e grupos.                                             |
| `evolution-delete-lead`, `evolution-delete-message` | ExclusÃ£o sincronizada de lado nosso + Evolution.                              |
| `evolution-test`               | Sonda usada pelo painel admin para validar credenciais.                                          |

**Contrato do webhook (`evolution-webhook`):**
1. Query `?token=` â†’ `loadInstanceByToken` â†’ 401 se invÃ¡lido.
2. Normaliza `body.data` em `items[]` (aceita `data`, `data.messages`, `data.chats`).
3. Dedup key = `${eventType}::${instance.id}::${items[0].key.id}::${timestamp}` via `webhook_dedup`.
4. Insere em `webhook_events` (audit append-only).
5. `MESSAGES_UPSERT` â†’ `ingestMessage` (em `Promise.allSettled`) + `downloadAndStoreMedia` em background para o bucket `chat-attachments`.
6. Sempre 200 (evita retry storm da Evolution).

**Invariantes:**
- **Nunca expor `evolution_api_key`/`webhook_token` ao cliente** â€” RLS coluna-nÃ­vel jÃ¡ revoga; edges usam `service_role`.
- **Path do anexo = `<message_id>/<filename>`** para casar com a RLS de `chat-attachments`.
- **Dedup obrigatÃ³rio** â€” sem `isWebhookDuplicate` a Evolution reenvia e duplica mensagens.

---

## 2. Stripe (pagamentos self-service internacional)

**Provedor:** Stripe via **connector gateway** (`connector-gateway.lovable.dev/stripe`). **Nunca** instanciar `new Stripe(STRIPE_SECRET_KEY)` diretamente â€” as env vars `STRIPE_SANDBOX_API_KEY`/`STRIPE_LIVE_API_KEY` sÃ£o identificadores de conexÃ£o do gateway, nÃ£o secrets Stripe reais.

**Segredos runtime:**
- `STRIPE_SANDBOX_API_KEY`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET` â€” sempre presentes.
- `STRIPE_LIVE_API_KEY`, `PAYMENTS_LIVE_WEBHOOK_SECRET` â€” presentes apÃ³s reivindicar sandbox.
- `LOVABLE_API_KEY` â€” autentica no gateway.

**Cliente compartilhado:** `supabase/functions/_shared/stripe.ts` â†’ `createStripeClient(env: 'sandbox'|'live')`. Fixa `apiVersion: '2026-03-25.dahlia'` e SDK `stripe@22.0.2`. Reescreve toda request de `api.stripe.com` para o gateway com `X-Connection-Api-Key` + `Lovable-API-Key`.

**SuperfÃ­cies:**
- `create-checkout` (nÃ£o listada acima â€” vive em outra pasta se aplicÃ¡vel) â†’ cria embedded Checkout Session.
- **`payments-webhook`** â†’ recebe `customer.subscription.*` do Stripe (assinado com `PAYMENTS_*_WEBHOOK_SECRET`). Atualiza `public.subscriptions` (Stripe self-service, F-INTL-4).
- **`pipeline-payment-webhook`** â†’ Marco 3 (`auto:payment-confirmed`). **NÃ£o Ã© Stripe** â€” endpoint interno chamado por provedor externo (Eduzz/outro) com `Authorization: Bearer <service_role_jwt>`. Seta `custom_fields.status_financeiro='pago'` sem mover stage. Ver `docs/maps/BILLING.md`.

**Invariantes:**
- **Env `sandbox` vs `live` Ã© sempre input validado do caller** â€” nunca defaultar; webhook lÃª do `?env=` na query.
- **NÃ£o trocar API version** sem auditar payloads (a doc `BILLING.md` assume dahlia).

---

## 3. Resend (transacionais / e-mail marketing)

**Provedor:** Resend, orquestrado pelo **Lovable Emails** (fila `pgmq` + `process-email-queue` a cada 5s).

**Segredos runtime:**
- `RESEND_API_KEY` â€” connector-managed. NÃ£o usar direto na app â€” todas as chamadas passam por Lovable Emails, exceto quando o usuÃ¡rio explicitamente escolher Resend puro.
- `RESEND_WEBHOOK_SECRET` â€” usado por `resend-webhook` (assinatura Svix).

**SuperfÃ­cies:**
- **`resend-webhook`** â†’ recebe eventos (`delivered`, `bounced`, `complained`, `opened`, `clicked`, `unsubscribed`) e insere em `resend_webhook_events` + atualiza `email_send_log`. Valida assinatura com `svix` (`svix-id`, `svix-timestamp`, `svix-signature`). Rejeita 401 se invÃ¡lido.
- **`backfill-resend-events`** â†’ job de reconciliaÃ§Ã£o. Puxa eventos histÃ³ricos da API do Resend para preencher lacunas em `email_send_log`.

**DomÃ­nios:** ver `docs/maps/EMAIL_MARKETING.md`. Cada `email_domains` tem `spf/dkim/dmarc` verificados pelo prÃ³prio Lovable via delegaÃ§Ã£o NS.

**Invariantes:**
- Nunca **desabilitar** Lovable Emails sem remover NS records do domÃ­nio no registrar do usuÃ¡rio.
- Sempre validar assinatura Svix â€” sem ela o webhook Ã© aberto e pode ser forjado.

---

## 4. Eduzz (legado â€” checkout Custom Delivery)

**Provedor:** [Eduzz Custom Delivery](https://github.com/eduzz/custom-delivery). Endpoint **pÃºblico** sem JWT (registrado com `verify_jwt = false`).

**SuperfÃ­cie Ãºnica:** `eduzz-webhook`
- URL: `POST /functions/v1/eduzz-webhook/<plan_code>` (o `plan_code` vem do path).
- Body: `application/x-www-form-urlencoded` **ou** JSON com campos `edz_*`.
- AutenticaÃ§Ã£o: **secret compartilhado por plano** â€” Eduzz envia `edz_cli_origin_secret` no payload; o handler compara com `plans.eduzz_origin_secret` via `safeEq` (constant-time). Sem match â†’ grava com `status=rejected` mas retorna 200 (evita retry).
- IdempotÃªncia: `(fat_cod, cnt_cod)` Ãºnico em `eduzz_purchases`; upsert.
- Efeitos: cria/upserta `clinic_subscriptions` para o plano correspondente. Suporta `order_bump` (item adicional na mesma fatura).

**Invariantes:**
- **Sempre retornar 200** em erros conhecidos (registrados em `eduzz_purchases.status`) â€” Eduzz retenta indefinidamente em 5xx.
- **NÃ£o confundir `eduzz-webhook` com `payments-webhook`** â€” modelos de assinatura distintos (clinic vs user).

---

## 5. Meta (WhatsApp Cloud API, Instagram, Facebook) â€” roadmap

**Status:** nÃ£o implementado. Roadmap detalhado em `docs/roadmap/META_API.md` (10 fases `F-META-0` a `F-META-9`).

**Plano de segredos futuro:** `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_SYSTEM_USER_TOKEN` â€” todos via `add_secret`, nunca hardcoded. Cada `whatsapp_instances` ganharÃ¡ colunas `meta_phone_number_id`, `meta_waba_id` e substituirÃ¡ `evolution_*` quando a clÃ­nica migrar.

**NÃ£o iniciar implementaÃ§Ã£o** sem retomar o roadmap com o usuÃ¡rio.

---

## 6. Google Gemini (BYOK â€” Bring Your Own Key)

**Provedor:** Google AI Studio (`generativelanguage.googleapis.com`), **direto** (nÃ£o passa por Lovable AI Gateway quando a clÃ­nica traz sua prÃ³pria chave).

**Segredos:** armazenados em `clinic_secrets.gemini_api_key` (RLS estrita â€” apenas `service_role` lÃª). UI de gestÃ£o: `src/components/settings/OpenAIKeyCard.tsx` (aba Google).

**SuperfÃ­cies:** `_shared/clinic-gemini.ts` e `_shared/lovable-ai.ts` decidem o provider por request:
- Se `ai_agents.provider = 'google'` e clÃ­nica tem chave â†’ chama direto.
- Se provider = `openai` â†’ clÃ­nica pode ter `openai_api_key` (BYOK) ou fallback para Lovable AI Gateway (`LOVABLE_API_KEY` + `google/gemini-2.5-flash` grÃ¡tis).
- Fallback automÃ¡tico: quota exceeded (429) â†’ tenta o outro provider disponÃ­vel.

Ver `docs/maps/AI_AGENTS.md` para o runtime completo (spend guard, RAG, telemetria).

**Invariantes:**
- **Chave BYOK sÃ³ acessÃ­vel pelo edge com service_role.** Nunca serializar para o frontend.
- **`AIPipelinesCard` (settings)** gateia em quais pipelines os agentes atuam â€” respeitar antes de gastar crÃ©ditos.

---

## 7. Outros / auxiliares

- **OpenAI (BYOK)**: `clinic_secrets.openai_api_key`. Provider secundÃ¡rio/fallback em `_shared/clinic-openai.ts`. Sem edge function dedicada â€” usado dentro dos agents.
- **Lovable AI Gateway** (`LOVABLE_API_KEY`): default para agents sem BYOK. Suporta chat, embeddings, image gen, TTS/STT.
- **Whisper (OpenAI)**: usado por `transcribe-audio` para transcrever Ã¡udios do WhatsApp. Requer signed URL de 10 min do bucket `chat-attachments` (ver `STORAGE_UPLOADS.md`).

## 8. Matriz de webhooks (pÃºblicos)

| Endpoint                        | AutenticaÃ§Ã£o                                       | Retry policy       | Dedup                          |
| ------------------------------- | -------------------------------------------------- | ------------------ | ------------------------------ |
| `evolution-webhook`             | Query `?token=` = `whatsapp_instances.webhook_token` | Sempre 200         | `webhook_dedup` por event+ts   |
| `resend-webhook`                | Svix (`svix-signature`)                            | 401 se invÃ¡lido    | `resend_webhook_events` PK     |
| `eduzz-webhook`                 | Field `edz_cli_origin_secret` + `safeEq`           | Sempre 200         | `(fat_cod, cnt_cod)` unique    |
| `payments-webhook` (Stripe)     | `PAYMENTS_*_WEBHOOK_SECRET` (Stripe signing)       | 400 se invÃ¡lido    | `stripe_event.id` idempotente  |
| `pipeline-payment-webhook`      | Bearer JWT com `role=service_role`                 | 401 se nÃ£o service | `lead_id` + timestamp da run   |

## 9. Invariantes globais

1. **Nenhuma chave de provedor no frontend.** Todas as chamadas passam por edge function com `service_role`.
2. **Todo webhook pÃºblico valida origem** (assinatura, token na URL, ou secret no body constant-time). Sem exceÃ§Ã£o.
3. **Retries idempotentes por design** â€” cada webhook tem chave de dedup prÃ³pria.
4. **`STRIPE_*_API_KEY` NÃƒO Ã© secret Stripe real.** Sempre `createStripeClient(env)`.
5. **Evolution â‰  Meta.** NÃ£o misturar campos de instÃ¢ncia â€” `evolution_api_key` Ã— `meta_phone_number_id` sÃ£o mundos diferentes.
6. **Eduzz e Stripe modelam assinatura em tabelas distintas** (`clinic_subscriptions` Ã— `subscriptions`). Nunca cruzar sem entender o motivo â€” ver `BILLING.md` Â§dÃ­vidas tÃ©cnicas.

## 10. DÃ­vidas tÃ©cnicas

- **Sem retry manual para `resend-webhook` invÃ¡lido** â€” se Svix rejeitar por relÃ³gio dessincronizado, evento Ã© perdido. `backfill-resend-events` reconcilia mas com janela.
- **`evolution-webhook` retorna 200 mesmo em falha de ingest** â€” precisamos de fila DLQ para reprocessar mensagens que falharam em `ingestMessage`.
- **`eduzz-webhook` nÃ£o valida assinatura HMAC** â€” sÃ³ o `origin_secret` no body. Um vazamento do secret Ã© fatal; rotacionar via `plans.eduzz_origin_secret` requer coordenaÃ§Ã£o manual com o vendedor.
- **Sem observabilidade unificada de webhooks externos** â€” `AdminObservability` mostra pipeline runs mas nÃ£o taxa de erro por webhook pÃºblico.
- **Meta ainda no roadmap** â€” enquanto isso, `whatsapp_instances` sÃ³ serve Evolution.

---

**Fase 12 concluÃ­da.** Sigo para **Fase 13** conforme `docs/roadmap/DOCS_MAINTENANCE.md`?

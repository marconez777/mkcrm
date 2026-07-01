---
title: "Integrações externas — Resend, Meta, Google, Stripe, Evolution, Eduzz"
topic: integracao
kind: map
audience: agent
updated: 2026-07-01
summary: "Mapa unificado das integrações externas do Chat Funnel AI: Evolution API (WhatsApp), Stripe via connector gateway, Resend (via Lovable Emails + webhook Svix), Eduzz (webhook público de vendas), Meta (roadmap), Google (BYOK Gemini). Cobre autenticação, endpoints, segredos, dedup e invariantes."
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
  - docs/maps/WHATSAPP.md
  - docs/maps/EVOLUTION_EDGES.md
  - docs/maps/BILLING.md
  - docs/maps/EMAIL_MARKETING.md
  - docs/maps/STORAGE_UPLOADS.md
---

# Integrações externas

Este mapa é o **índice único** das integrações externas com terceiros. Cada
seção lista provedor, segredos, superfícies de entrada/saída e invariantes.
Detalhes profundos ficam nos mapas específicos (`EVOLUTION_EDGES.md`,
`WHATSAPP.md`, `BILLING.md`, `EMAIL_MARKETING.md`).

## 1. Evolution API (WhatsApp não-oficial)

**Provedor:** instância própria/gerenciada da Evolution API v2.

**Segredos runtime:**
- `EVOLUTION_GLOBAL_URL` — base URL da instância global (sem barra final).
- `EVOLUTION_GLOBAL_API_KEY` — chave admin para provisionar/deletar instâncias.
- Por instância (persistidos em `public.whatsapp_instances`): `evolution_api_key`, `webhook_token` (não legíveis por `authenticated`, apenas `service_role`).

**Superfícies (18 edge functions):** todas usam `_shared/evolution.ts` (`sb()`, `json`, `requireUser`, `ingestMessage`, `downloadAndStoreMedia`, `loadInstanceByToken`).

| Função                         | Papel                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `evolution-provision`          | Cria instância na Evolution + linha em `whatsapp_instances`. Requer clinic member ou super admin. |
| `evolution-qr`                 | Retorna QR code base64 para pareamento inicial.                                                 |
| `evolution-restart`, `evolution-logout`, `evolution-delete-instance` | Ciclo de vida da instância.                                             |
| `evolution-health`             | Ping/status. Usado por `AdminPipelineHealth` e monitor interno.                                 |
| `evolution-webhook`            | **Entrada única de eventos.** Autenticada por `?token=<webhook_token>` (query param), não JWT. Dedup por `webhook_events` + `webhook_dedup`. |
| `evolution-send`, `evolution-send-media` | Envio outbound de texto/mídia. Usados por Composer e Broadcasts.                    |
| `evolution-collect-leads`, `evolution-backfill-all`, `evolution-fetch-groups`, `evolution-sync-lead` | Backfill de histórico e grupos.                                             |
| `evolution-delete-lead`, `evolution-delete-message` | Exclusão sincronizada de lado nosso + Evolution.                              |
| `evolution-test`               | Sonda usada pelo painel admin para validar credenciais.                                          |

**Contrato do webhook (`evolution-webhook`):**
1. Query `?token=` → `loadInstanceByToken` → 401 se inválido.
2. Normaliza `body.data` em `items[]` (aceita `data`, `data.messages`, `data.chats`).
3. Dedup key = `${eventType}::${instance.id}::${items[0].key.id}::${timestamp}` via `webhook_dedup`.
4. Insere em `webhook_events` (audit append-only).
5. `MESSAGES_UPSERT` → `ingestMessage` (em `Promise.allSettled`) + `downloadAndStoreMedia` em background para o bucket `chat-attachments`.
6. Sempre 200 (evita retry storm da Evolution).

**Invariantes:**
- **Nunca expor `evolution_api_key`/`webhook_token` ao cliente** — RLS coluna-nível já revoga; edges usam `service_role`.
- **Path do anexo = `<message_id>/<filename>`** para casar com a RLS de `chat-attachments`.
- **Dedup obrigatório** — sem `isWebhookDuplicate` a Evolution reenvia e duplica mensagens.

---

## 2. Stripe (pagamentos self-service internacional)

**Provedor:** Stripe via **connector gateway** (`connector-gateway.lovable.dev/stripe`). **Nunca** instanciar `new Stripe(STRIPE_SECRET_KEY)` diretamente — as env vars `STRIPE_SANDBOX_API_KEY`/`STRIPE_LIVE_API_KEY` são identificadores de conexão do gateway, não secrets Stripe reais.

**Segredos runtime:**
- `STRIPE_SANDBOX_API_KEY`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET` — sempre presentes.
- `STRIPE_LIVE_API_KEY`, `PAYMENTS_LIVE_WEBHOOK_SECRET` — presentes após reivindicar sandbox.
- `LOVABLE_API_KEY` — autentica no gateway.

**Cliente compartilhado:** `supabase/functions/_shared/stripe.ts` → `createStripeClient(env: 'sandbox'|'live')`. Fixa `apiVersion: '2026-03-25.dahlia'` e SDK `stripe@22.0.2`. Reescreve toda request de `api.stripe.com` para o gateway com `X-Connection-Api-Key` + `Lovable-API-Key`.

**Superfícies:**
- `create-checkout` (não listada acima — vive em outra pasta se aplicável) → cria embedded Checkout Session.
- **`payments-webhook`** → recebe `customer.subscription.*` do Stripe (assinado com `PAYMENTS_*_WEBHOOK_SECRET`). Atualiza `public.subscriptions` (Stripe self-service, F-INTL-4).
- **`pipeline-payment-webhook`** → Marco 3 (`auto:payment-confirmed`). **Não é Stripe** — endpoint interno chamado por provedor externo (Eduzz/outro) com `Authorization: Bearer <service_role_jwt>`. Seta `custom_fields.status_financeiro='pago'` sem mover stage. Ver `docs/maps/BILLING.md`.

**Invariantes:**
- **Env `sandbox` vs `live` é sempre input validado do caller** — nunca defaultar; webhook lê do `?env=` na query.
- **Não trocar API version** sem auditar payloads (a doc `BILLING.md` assume dahlia).

---

## 3. Resend (transacionais / e-mail marketing)

**Provedor:** Resend, orquestrado pelo **Lovable Emails** (fila `pgmq` + `process-email-queue` a cada 5s).

**Segredos runtime:**
- `RESEND_API_KEY` — connector-managed. Não usar direto na app — todas as chamadas passam por Lovable Emails, exceto quando o usuário explicitamente escolher Resend puro.
- `RESEND_WEBHOOK_SECRET` — usado por `resend-webhook` (assinatura Svix).

**Superfícies:**
- **`resend-webhook`** → recebe eventos (`delivered`, `bounced`, `complained`, `opened`, `clicked`, `unsubscribed`) e insere em `resend_webhook_events` + atualiza `email_send_log`. Valida assinatura com `svix` (`svix-id`, `svix-timestamp`, `svix-signature`). Rejeita 401 se inválido.
- **`backfill-resend-events`** → job de reconciliação. Puxa eventos históricos da API do Resend para preencher lacunas em `email_send_log`.

**Domínios:** ver `docs/maps/EMAIL_MARKETING.md`. Cada `email_domains` tem `spf/dkim/dmarc` verificados pelo próprio Lovable via delegação NS.

**Invariantes:**
- Nunca **desabilitar** Lovable Emails sem remover NS records do domínio no registrar do usuário.
- Sempre validar assinatura Svix — sem ela o webhook é aberto e pode ser forjado.

---

## 4. Eduzz (legado — checkout Custom Delivery)

**Provedor:** [Eduzz Custom Delivery](https://github.com/eduzz/custom-delivery). Endpoint **público** sem JWT (registrado com `verify_jwt = false`).

**Superfície única:** `eduzz-webhook`
- URL: `POST /functions/v1/eduzz-webhook/<plan_code>` (o `plan_code` vem do path).
- Body: `application/x-www-form-urlencoded` **ou** JSON com campos `edz_*`.
- Autenticação: **secret compartilhado por plano** — Eduzz envia `edz_cli_origin_secret` no payload; o handler compara com `plans.eduzz_origin_secret` via `safeEq` (constant-time). Sem match → grava com `status=rejected` mas retorna 200 (evita retry).
- Idempotência: `(fat_cod, cnt_cod)` único em `eduzz_purchases`; upsert.
- Efeitos: cria/upserta `clinic_subscriptions` para o plano correspondente. Suporta `order_bump` (item adicional na mesma fatura).

**Invariantes:**
- **Sempre retornar 200** em erros conhecidos (registrados em `eduzz_purchases.status`) — Eduzz retenta indefinidamente em 5xx.
- **Não confundir `eduzz-webhook` com `payments-webhook`** — modelos de assinatura distintos (clinic vs user).

---

## 5. Meta (WhatsApp Cloud API, Instagram, Facebook) — roadmap

**Status:** não implementado. Roadmap detalhado em `docs/roadmap/META_API.md` (10 fases `F-META-0` a `F-META-9`).

**Plano de segredos futuro:** `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_SYSTEM_USER_TOKEN` — todos via `add_secret`, nunca hardcoded. Cada `whatsapp_instances` ganhará colunas `meta_phone_number_id`, `meta_waba_id` e substituirá `evolution_*` quando a clínica migrar.

**Não iniciar implementação** sem retomar o roadmap com o usuário.

---

## 6. Google Gemini (BYOK — Bring Your Own Key)

**Provedor:** Google AI Studio (`generativelanguage.googleapis.com`), **direto** (não passa por Lovable AI Gateway quando a clínica traz sua própria chave).

**Segredos:** armazenados em `clinic_secrets.gemini_api_key` (RLS estrita — apenas `service_role` lê). UI de gestão: `src/components/settings/OpenAIKeyCard.tsx` (aba Google).

**Superfícies:** `_shared/clinic-gemini.ts` e `_shared/lovable-ai.ts` decidem o provider por request:
- Se `ai_agents.provider = 'google'` e clínica tem chave → chama direto.
- Se provider = `openai` → clínica pode ter `openai_api_key` (BYOK) ou fallback para Lovable AI Gateway (`LOVABLE_API_KEY` + `google/gemini-2.5-flash` grátis).
- Fallback automático: quota exceeded (429) → tenta o outro provider disponível.

Ver `docs/maps/AI_AGENTS.md` para o runtime completo (spend guard, RAG, telemetria).

**Invariantes:**
- **Chave BYOK só acessível pelo edge com service_role.** Nunca serializar para o frontend.
- **`AIPipelinesCard` (settings)** gateia em quais pipelines os agentes atuam — respeitar antes de gastar créditos.

---

## 7. Outros / auxiliares

- **OpenAI (BYOK)**: `clinic_secrets.openai_api_key`. Provider secundário/fallback em `_shared/clinic-openai.ts`. Sem edge function dedicada — usado dentro dos agents.
- **Lovable AI Gateway** (`LOVABLE_API_KEY`): default para agents sem BYOK. Suporta chat, embeddings, image gen, TTS/STT.
- **Whisper (OpenAI)**: usado por `transcribe-audio` para transcrever áudios do WhatsApp. Requer signed URL de 10 min do bucket `chat-attachments` (ver `STORAGE_UPLOADS.md`).

## 8. Matriz de webhooks (públicos)

| Endpoint                        | Autenticação                                       | Retry policy       | Dedup                          |
| ------------------------------- | -------------------------------------------------- | ------------------ | ------------------------------ |
| `evolution-webhook`             | Query `?token=` = `whatsapp_instances.webhook_token` | Sempre 200         | `webhook_dedup` por event+ts   |
| `resend-webhook`                | Svix (`svix-signature`)                            | 401 se inválido    | `resend_webhook_events` PK     |
| `eduzz-webhook`                 | Field `edz_cli_origin_secret` + `safeEq`           | Sempre 200         | `(fat_cod, cnt_cod)` unique    |
| `payments-webhook` (Stripe)     | `PAYMENTS_*_WEBHOOK_SECRET` (Stripe signing)       | 400 se inválido    | `stripe_event.id` idempotente  |
| `pipeline-payment-webhook`      | Bearer JWT com `role=service_role`                 | 401 se não service | `lead_id` + timestamp da run   |

## 9. Invariantes globais

1. **Nenhuma chave de provedor no frontend.** Todas as chamadas passam por edge function com `service_role`.
2. **Todo webhook público valida origem** (assinatura, token na URL, ou secret no body constant-time). Sem exceção.
3. **Retries idempotentes por design** — cada webhook tem chave de dedup própria.
4. **`STRIPE_*_API_KEY` NÃO é secret Stripe real.** Sempre `createStripeClient(env)`.
5. **Evolution ≠ Meta.** Não misturar campos de instância — `evolution_api_key` × `meta_phone_number_id` são mundos diferentes.
6. **Eduzz e Stripe modelam assinatura em tabelas distintas** (`clinic_subscriptions` × `subscriptions`). Nunca cruzar sem entender o motivo — ver `BILLING.md` §dívidas técnicas.

## 10. Dívidas técnicas

- **Sem retry manual para `resend-webhook` inválido** — se Svix rejeitar por relógio dessincronizado, evento é perdido. `backfill-resend-events` reconcilia mas com janela.
- **`evolution-webhook` retorna 200 mesmo em falha de ingest** — precisamos de fila DLQ para reprocessar mensagens que falharam em `ingestMessage`.
- **`eduzz-webhook` não valida assinatura HMAC** — só o `origin_secret` no body. Um vazamento do secret é fatal; rotacionar via `plans.eduzz_origin_secret` requer coordenação manual com o vendedor.
- **Sem observabilidade unificada de webhooks externos** — `AdminObservability` mostra pipeline runs mas não taxa de erro por webhook público.
- **Meta ainda no roadmap** — enquanto isso, `whatsapp_instances` só serve Evolution.

---

**Fase 12 concluída.** Sigo para **Fase 13** conforme `docs/roadmap/DOCS_MAINTENANCE.md`?

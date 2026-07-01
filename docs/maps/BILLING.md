# Billing / Payments / Plans

Última auditoria: Fase 9 do roadmap **F-DOC-FULL**.

Este mapa cobre TODO o ecossistema de cobrança do Chat Funnel AI, que hoje
opera em **dois modelos paralelos**:

1. **Stripe (SaaS multi-moeda, F-INTL-4)** — checkout self-service B2B, moedas
   BRL / EUR / USD, ciclo mensal ou anual, gerenciado via Stripe Billing Portal.
2. **Eduzz / Manual (legado brasileiro)** — webhooks de order-bump e concessão
   manual pelo super admin, com catálogo próprio em `public.plans` +
   `public.clinic_subscriptions`.

Os dois modelos coexistem: Stripe alimenta `public.subscriptions` (por
usuário), enquanto Eduzz/manual alimenta `public.clinic_subscriptions` (por
clínica). A UI de billing padrão (`/billing`) usa Stripe; o painel admin
super usa o modelo por clínica.

---

## 1. Catálogo de planos

### 1.1 Frontend — `src/lib/plans.ts`

Catálogo hard-coded, fonte da verdade para preços exibidos ao cliente e
para os `price_id` usados no Stripe (formato `{plan}_{interval}_{currency}`).

| Plano    | BRL/mês | EUR/mês | USD/mês | Destaque             |
| -------- | ------- | ------- | ------- | -------------------- |
| Starter  | 77      | 17      | 19      | Entrada              |
| Pro      | 147     | 35      | 39      | `Mais escolhido`     |
| Supreme  | 297     | 69      | 79      | Top tier / White-label |

Cada plano define `features[]` (bullets exibidos no card) e `prices[currency]`
com `monthly` e `yearly`. `planLabelFromPriceId(priceId)` traduz para
`"Pro (mensal)"` etc.

Os `price_id` **precisam existir no Stripe com `lookup_key` idêntico** —
`create-checkout` resolve o preço via `stripe.prices.list({ lookup_keys })`.

### 1.2 Backend — `public.plans` (Eduzz/manual)

Migration: `20260603000729_*.sql`.

Colunas relevantes: `code`, `name`, `price_monthly_brl`, `price_yearly_brl`,
`features jsonb`, `limits jsonb`, `sort_order`, `is_active`, `is_public`.
Seed inicial: `free`, `starter`, `pro`, `enterprise`.

- RLS: leitura livre para `authenticated`; INSERT/UPDATE/DELETE só via
  `is_super_admin()`.
- GRANT `SELECT` para `authenticated`, `ALL` para `service_role`.
- `features` e `limits` são copiados em `clinics.settings` no momento da
  concessão do plano (ver §4.1).

> **Divergência atual:** o catálogo Stripe (BRL/EUR/USD) NÃO está sincronizado
> com `public.plans`. `plans` serve apenas ao caminho manual/Eduzz. Qualquer
> unificação futura deve fazer join por `code`.

---

## 2. Stripe — Checkout self-service

### 2.1 Fluxo

```text
/billing (Billing.tsx)
   └─▶ Link para /checkout/:priceId (Checkout.tsx)
          └─▶ <StripeEmbeddedCheckout />
                 └─▶ supabase.functions.invoke("create-checkout")
                        └─▶ Stripe API (via gateway) → clientSecret
                 └─▶ Stripe monta form inline (embedded_page)
   ◀── return_url: /checkout/return?session_id={CHECKOUT_SESSION_ID}
```

Componentes:

- `src/pages/Billing.tsx` (160 LOC) — lista planos filtrados por moeda
  regional (`useRegion`), consulta assinatura atual via `useSubscription`.
- `src/pages/Checkout.tsx` (43 LOC) — apenas monta o embedded checkout com o
  `priceId` da URL. Inclui `<PaymentTestModeBanner />`.
- `src/pages/CheckoutReturn.tsx` (35 LOC) — página de sucesso pós-pagamento,
  não busca o status (webhook processa em background).
- `src/hooks/useSubscription.ts` — lê `public.subscriptions` filtrando por
  `user_id` + `environment` (sandbox|live) e escuta Realtime.

### 2.2 Edge Function `create-checkout` (150 LOC)

Fluxo (`supabase/functions/create-checkout/index.ts`):

1. Valida body (`priceId`, `returnUrl`, `environment`).
2. Se `Authorization: Bearer` presente, resolve `userId`/`email` via
   `supabase.auth.getUser(token)`.
3. `resolveOrCreateCustomer` — busca Customer por
   `metadata['userId']` → depois por email → depois cria novo com
   `metadata.userId`. Isso é **obrigatório** para o Search API funcionar.
4. Resolve `stripePrice` via `stripe.prices.list({ lookup_keys: [priceId] })`.
5. Cria session com:
   - `ui_mode: "embedded_page"`
   - `mode: isRecurring ? "subscription" : "payment"`
   - `automatic_tax: { enabled: true }`
   - `customer_update: { address: "auto" }`
   - `subscription_data.metadata.userId` (para webhooks)
   - `payment_intent_data.description` (só para one-off; nome do produto)
6. Retorna `{ clientSecret }`.

Roteia via `createStripeClient(env)` do `_shared/stripe.ts` (gateway
proxy — nunca chama Stripe diretamente com a chave gateway).

### 2.3 Edge Function `create-portal-session`

- Verifica JWT do usuário.
- Busca `stripe_customer_id` da última row em `subscriptions` (env-filtered).
- Cria `billingPortal.sessions.create({ customer, return_url })`.
- Retorna `{ url }` — frontend abre em **new tab** (portal NÃO funciona em
  iframe, portanto não abre dentro do preview do Lovable).

### 2.4 Edge Function `payments-webhook`

Handler Stripe (`?env=sandbox|live` no query string). Verifica assinatura via
`verifyWebhook` (HMAC-SHA256 sem SDK).

Eventos tratados:

| Evento                              | Ação                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| `customer.subscription.created`     | UPSERT em `subscriptions` (onConflict `stripe_subscription_id`) |
| `customer.subscription.updated`     | UPDATE status, price/product, período, `cancel_at_period_end` |
| `customer.subscription.deleted`     | UPDATE `status='canceled'`                                 |

`priceIdOf(item)` resolve na ordem: `price.lookup_key` →
`metadata.lovable_external_id` → `price.id` (garante estabilidade
sandbox↔live).

**Sempre grava `environment: env`** — sandbox e live coexistem na tabela e
todo read do frontend precisa filtrar por env.

### 2.5 Tabela `public.subscriptions`

Colunas: `user_id`, `stripe_subscription_id UNIQUE`, `stripe_customer_id`,
`product_id`, `price_id`, `status`, `current_period_start/end`,
`cancel_at_period_end`, `environment default 'sandbox'`.

RLS:

- `SELECT` — `auth.uid() = user_id`
- ALL — `service_role`

Função `has_active_subscription(user_uuid, check_env)` — retorna true para
`active`/`trialing`/`past_due` com período futuro **OU** `canceled` com
período futuro (grace period).

---

## 3. Legado Eduzz — order-bump BR

`supabase/functions/eduzz-webhook/index.ts` (344 LOC). Endpoint **público**
sem JWT, plan code na URL:

```
POST /functions/v1/eduzz-webhook/<plan_code>
```

- Aceita `application/json` **ou** `application/x-www-form-urlencoded`
  (Eduzz envia ambos dependendo da versão).
- Extrai campos `edz_*` (fat_cod, cnt_cod, cli_email, valorpago, etc.).
- Valida `edz_cli_origin_secret` (comparação constant-time via `safeEq`).
- Grava tudo em `public.eduzz_purchases` para auditoria.
- Sempre retorna HTTP 200 (evita retry de Eduzz) — falhas ficam logadas na
  linha `eduzz_purchases`.

Não integra com `subscriptions` do Stripe — é um caminho paralelo para
concessão manual ou automática de planos brasileiros.

---

## 4. Concessão manual pelo super admin

### 4.1 `admin-apply-plan` (125 LOC)

- Requer role `super_admin` (checa via `user_roles`).
- Body: `{ plan_code, clinic_ids[], overwrite_features, overwrite_limits,
  trial_days, expires_at, grant_reason, status }`.
- Para cada clínica:
  1. UPDATE `clinics.plan_id` + `clinics.settings.features/limits`.
  2. Marca `clinic_subscriptions` anteriores como `is_current=false,
     canceled_at=now()`.
  3. INSERT nova `clinic_subscriptions` com
     `source='manual'`, `granted_by`, `grant_reason`, `trial_ends_at`,
     `cancel_at=expires_at`, `is_current=true`.
  4. Registra em `audit_log` (`action='plan.apply'`).
- Retorna `{ ok, applied, total, errors[] }` — falhas por clínica são
  agregadas sem abortar o batch.

### 4.2 `admin-revoke-plan` (67 LOC)

- Requer `super_admin`.
- Cancela `clinic_subscriptions.is_current=true` (marca `canceled`, `canceled_at`).
- Cria nova assinatura de fallback (`fallback_plan_code`, default
  `starter`) com `status='past_due'`.
- Sobrescreve `clinics.plan_id + settings` para o fallback.

### 4.3 Tabela `public.clinic_subscriptions`

Modelo por clínica (não por usuário). Colunas relevantes: `clinic_id`,
`plan_id`, `status` (`active`|`trialing`|`past_due`|`canceled`|`manual_grant`),
`source`, `trial_ends_at`, `cancel_at`, `canceled_at`, `granted_by`,
`grant_reason`, `is_current`.

Somente uma row `is_current=true` por clínica ao mesmo tempo (garantido por
lógica no edge function; **não há unique constraint** — pode haver drift em
race conditions).

---

## 5. Marco 3 — `pipeline-payment-webhook` (49 LOC úteis)

Fluxo do agente comercial (auto:payment-confirmed), documentado em
`docs/pipeline/`.

- Auth: `Bearer <SUPABASE_SERVICE_ROLE_KEY>` (verifica `role: service_role`
  no JWT).
- Body: `{ lead_id, amount?, ref?, source? }`.
- Executa `runPaymentConfirmed()` de `_shared/pipeline-tasks.ts` — seta
  `custom_fields.status_financeiro='pago'`. **NÃO move stage** (regra D1).

Não é um webhook Stripe/Eduzz — é o hook interno para provedor externo
disparar a confirmação de pagamento e atualizar o lead no pipeline
comercial.

---

## 6. Test-mode banner & guardas de ambiente

- `src/components/payments/PaymentTestModeBanner.tsx` — renderiza banner
  laranja em sandbox, banner vermelho quando token faltando ("Complete
  Stripe go-live"). Nada é renderizado em live.
- `src/lib/stripe.ts` — `getStripeEnvironment()` deriva `sandbox`/`live` do
  prefixo (`pk_test_` / `pk_live_`) de `VITE_PAYMENTS_CLIENT_TOKEN`. Falha
  loud se ausente.
- Todo read de `subscriptions` no frontend precisa passar `environment`
  senão vaza rows do env errado após publish.

---

## 7. Pontos de atenção / dívidas técnicas

1. **Duplo modelo**: `subscriptions` (Stripe/usuário) vs
   `clinic_subscriptions` (Eduzz/manual/clínica) não conversam. Uma clínica
   pode ter plano manual `pro` enquanto o dono assina `starter` no Stripe —
   quem prevalece? Regra atual: `clinics.plan_id` (populado pelo admin)
   define features/limits reais. Stripe apenas provisiona acesso mas não
   sobrescreve `clinics.settings`.
2. **Sem unique constraint** em `clinic_subscriptions(clinic_id) WHERE
   is_current` — pode gerar duplicatas em concorrência.
3. **Catálogo Stripe hard-coded** em `src/lib/plans.ts` — se o preço no
   Stripe divergir, o usuário vê o preço antigo até build. Não há RPC que
   leia `plans` do banco para o frontend regional.
4. **Sem gate `has_active_subscription` no app** — features não checam
   assinatura server-side. Concessão manual (admin) e limites via
   `clinics.settings.limits` são as únicas barreiras.
5. **Portal fora do preview** — usuários que testam dentro do iframe do
   Lovable não conseguem abrir o portal. Sempre abrir preview em tab
   dedicada.

---

Fase 9 concluída. Próxima: **Fase 10 (Admin Console)**.

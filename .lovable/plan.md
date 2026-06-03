
# Plano: Planos manuais + Observabilidade + Dashboard Financeiro

Stripe fica para depois. Você ativa contas e registra pagamentos manualmente. Limites e features dos planos ficam vazios — você edita pela UI quando tiver o panorama.

---

## Fase 1 — Catálogo de planos + concessão manual

### 1.1 Reset do catálogo `plans`

Apaga seeds atuais (`free/starter/pro/enterprise`) e insere os 3 novos com `features={}` e `limits={}` (placeholders — você ajusta no `PlansPanel`):

| code | name | mensal (BRL) | anual (BRL) | sort | público |
|---|---|---|---|---|---|
| `starter` | Starter | 77,00 | 470,00 | 1 | sim |
| `pro` | Pro | 147,00 | 997,00 | 2 | sim |
| `supreme` | Supreme | 297,00 | 2997,00 | 3 | sim |

Adiciono colunas reservadas para Stripe (`stripe_product_id`, `stripe_price_id_monthly`, `stripe_price_id_yearly`) nullable.

### 1.2 `clinics.plan` → `plan_id`

- Adiciona `clinics.plan_id uuid references plans(id)`.
- Backfill: `pro` antigo → `pro` novo; demais → `starter` (default).
- Mantém `clinics.plan text` espelhado por trigger (compat).

### 1.3 Nova `clinic_subscriptions` (current + histórico)

`clinic_id`, `plan_id`, `status` (`trialing|active|past_due|canceled|manual_grant`), `source` (`manual|stripe`), `trial_ends_at`, `current_period_start/end`, `cancel_at`, `canceled_at`, `granted_by`, `grant_reason`, `stripe_subscription_id?`, `stripe_customer_id?`. RLS: SELECT da própria clínica; escrita só `is_super_admin()`.

### 1.4 Auditoria `plan_change_log`

Trigger em `clinic_subscriptions` registra `from_plan`, `to_plan`, `changed_by`, `reason`, `source`, `created_at`.

### 1.5 Default + resolução

- Default = `starter` com `status='trialing'`, 7 dias de trial em clínica nova (placeholder — fácil de mudar depois).
- `manual_grant` expirada → volta para `starter` `past_due`.
- Função `current_clinic_plan(_clinic uuid)` resolve plano efetivo.

### 1.6 Edge functions

- **`admin-apply-plan` (expandir)**: cria/atualiza `clinic_subscriptions` com `source='manual'`, aceita `trial_days?`, `expires_at?`, `grant_reason?`.
- **`admin-revoke-plan` (nova)**: encerra concessão, opcionalmente devolve ao default.
- **`cron-expire-manual-grants` (nova, diária)**: expira `manual_grant` vencidas.

### 1.7 Frontend (Admin)

- **`PlansPanel`**: recebe os 3 novos seedados; CRUD existente já cobre edição de features/limits.
- **`ClinicDetailsDialog`** ganha aba **"Plano & Assinatura"**: plano atual, fonte, período, trial; botões Trocar plano / Estender trial / Definir expiração / Revogar; histórico.

### 1.8 Doc

Novo `docs/maps/BILLING_PLANS.md` (9 seções). Atualiza `docs/MAP.md`, `docs/maps/ADMIN_SUPER_ADMIN.md`, `docs/architecture/PLANS_LIMITS.md`.

---

## Fase 2 — Observabilidade

### Banco

- `feature_events` (particionada por mês): `clinic_id`, `user_id`, `feature`, `action`, `entity_id?`, `metadata`, `created_at`.
- `error_events`: `clinic_id?`, `user_id?`, `surface` (`frontend|edge_function|trigger`), `route?`, `function_name?`, `error_message`, `error_stack?`, `severity`, `metadata`, `created_at`.
- MVs diárias: `mv_feature_usage_daily`, `mv_error_rate_daily` (cron refresh).
- RPCs gated `is_super_admin()`: `admin_feature_usage(_days)`, `admin_dead_features(_days)`, `admin_error_summary(_days)`.

### Instrumentação

- Hook `useTrackFeature(feature, action, metadata?)` → edge `track-event` (batch + debounce).
- `_shared/log-error.ts` para edges.
- `ErrorBoundary` global → edge `log-frontend-error`.

### Frontend

- **`/admin/observability`**: KPIs (eventos hoje/7d, erro 24h, features sem uso 30d), gráfico de uso por feature, tabela "features mortas", lista de erros com filtros + modal de stack.
- **`ClinicDetailsDialog`** ganha aba **"Atividade"** (timeline 30d).

### Doc

Novo `docs/maps/OBSERVABILITY.md`; atualiza `docs/operations/OBSERVABILITY.md` e `docs/MAP.md`.

---

## Fase 3 — Dashboard financeiro (manual)

### Banco

- `invoices` (independente de gateway): `clinic_id`, `subscription_id`, `amount_brl`, `currency` (BRL), `status` (`draft|open|paid|overdue|void`), `issued_at`, `due_date`, `paid_at?`, `payment_method?` (PIX/Transferência/Boleto/Stripe), `period_start/end`, `description`, `notes`, `stripe_invoice_id?` (reservado), `created_by`.
- `payment_receipts` (opcional, Storage para comprovantes).
- Job diário marca `open` vencidas como `overdue`.
- RPCs gated:
  - `admin_finance_kpis()` → MRR, ARR, receita mês, inadimplência R$/%, ticket médio, pagantes, trial, manual_grant
  - `admin_revenue_timeseries(_months)` → série mensal
  - `admin_overdue_list()` → inadimplentes
  - `admin_plan_distribution()` → contagem ativa por plano

### Frontend

- **`/admin/finance`**: KPIs topo, gráfico de receita 12m, tabela de inadimplentes (marcar pago / void / contatar), donut por plano, export CSV.
- **`ClinicDetailsDialog`**: dialogs "Registrar pagamento" (cria invoice `paid`) e "Gerar fatura" (cria `open`).

### Doc

Novo `docs/maps/FINANCE_DASHBOARD.md`; atualiza `docs/MAP.md`.

---

## Ordem

```text
Fase 1 (planos + clinic_subscriptions)
   └──> Fase 3 (finance usa subscriptions)
Fase 2 (observabilidade) — independente, encaixo depois da 1
```

Tudo preparado para a Fase 4 (Stripe manual): colunas `stripe_*` já reservadas, `source='manual'` ignora webhooks futuros.

---

Aprove o plano e eu começo pela Fase 1.

# Mapa — Billing, Planos & Financeiro

> **Quando ler:** ao mexer em catálogo de planos, concessão manual de plano, assinaturas, faturas, KPIs financeiros ou observabilidade.
> **Última atualização:** 2026-06-03

## 1. Visão

Sistema de planos manuais (sem gateway). Super admin libera planos pelo painel; pagamentos são registrados manualmente como `invoices`. Observabilidade roda em paralelo (`feature_events`, `error_events`). Stripe será integrado depois (colunas `stripe_*` já reservadas em `plans`, `clinic_subscriptions` e `invoices`).

## 2. Fluxos principais

```text
Super admin → /admin → aba Clínicas → Detalhes → "Plano & Assinatura"
   └─ Aplicar plano  → edge admin-apply-plan  → clinic_subscriptions (manual)
   └─ Revogar plano  → edge admin-revoke-plan → fallback Starter

/admin → aba Financeiro
   └─ Registrar pagamento / fatura → edge admin-invoice (create/mark_paid/void)
   └─ KPIs: admin_finance_kpis / admin_revenue_timeseries / admin_overdue_list / admin_plan_distribution

/admin → aba Observabilidade
   └─ Hook useTrackFeature → edge track-event → feature_events
   └─ ErrorBoundary global → edge log-frontend-error → error_events
   └─ RPCs: admin_feature_usage / admin_dead_features / admin_error_summary

Cron diários:
   └─ cron-expire-manual-grants  (03:10 UTC) → expira manual_grant vencidos
   └─ mark_overdue_invoices()    (03:00 UTC) → marca faturas vencidas
```

## 3. Frontend

- `src/pages/Admin.tsx` — abas Planos / Financeiro / Observabilidade.
- `src/components/admin/PlansPanel.tsx` — CRUD do catálogo.
- `src/components/admin/ClinicDetailsDialog.tsx` — aba "Plano & Assinatura" com aplicar/revogar/histórico.
- `src/components/admin/FinancePanel.tsx` — KPIs, gráfico, inadimplentes, distribuição.
- `src/components/admin/ObservabilityPanel.tsx` — uso por feature, dead features, erros recentes.
- `src/components/ErrorBoundary.tsx` — captura erros React → `log-frontend-error`.
- `src/hooks/useTrackFeature.ts` — batch (2s) + flush em beforeunload.

## 4. Edge functions

| Função | Quem chama | O que faz |
|---|---|---|
| `admin-apply-plan` | super admin | Cria/atualiza `clinic_subscriptions` manual, espelha features/limits |
| `admin-revoke-plan` | super admin | Encerra subscription corrente, joga para Starter `past_due` |
| `cron-expire-manual-grants` | pg_cron diário | Expira concessões manuais com `cancel_at`/`trial_ends_at` vencidos |
| `admin-invoice` | super admin | `create` / `mark_paid` / `void` / `delete` de fatura |
| `track-event` | qualquer autenticado | Insere batch em `feature_events` |
| `log-frontend-error` | qualquer (auth ou não) | Insere em `error_events` (frontend) |

## 5. Banco

**Tabelas novas:** `clinic_subscriptions`, `plan_change_log`, `feature_events`, `error_events`, `invoices`, `payment_receipts`.

**Alterações em `plans`:** + `stripe_product_id`, `stripe_price_id_monthly`, `stripe_price_id_yearly`.
**Alterações em `clinics`:** + `plan_id uuid → plans(id)`; `plan` text mantido como espelho via trigger `trg_clinics_sync_plan_text`.

**RPCs:** `current_clinic_plan(uuid)`, `admin_finance_kpis()`, `admin_revenue_timeseries(int)`, `admin_overdue_list()`, `admin_plan_distribution()`, `admin_feature_usage(int)`, `admin_dead_features(int)`, `admin_error_summary(int)`, `mark_overdue_invoices()`.

**Triggers:**
- `clinic_subscriptions_validate` — status/source no enum textual.
- `clinic_subscriptions_audit` — popula `plan_change_log`.
- `clinic_subscriptions_sync_clinic_plan` — sincroniza `clinics.plan_id` quando `is_current=true`.
- `invoices_validate` — status/valor.
- `error_events_validate` — surface/severity.

**RLS:** todas as tabelas novas — SELECT por `current_clinic_id() OR is_super_admin()`; mutação só `is_super_admin()` (exceto `feature_events`/`error_events` que aceitam INSERT do próprio usuário).

## 6. Cron

- `cron-expire-manual-grants-daily` → `10 3 * * *` (HTTP para edge function).
- `mark-overdue-invoices-daily` → `0 3 * * *` (SQL direto).

## 7. Invariantes / "cuidado ao editar"

- **Só uma subscription `is_current` por clínica**: garantido por índice único parcial. Ao trocar plano, encerre a anterior com `is_current=false` ANTES (admin-apply-plan já faz).
- **`clinics.plan` é espelho** — não escreva direto, mude `plan_id` e o trigger sincroniza.
- **`plan_change_log` é populado automaticamente** — não duplique inserts manuais.
- **`feature_events.insert` policy** requer `clinic_id = current_clinic_id() OR is_super_admin()` — o edge `track-event` resolve `clinic_id` server-side a partir do `clinic_members`.
- **`log-frontend-error` não rejeita anônimo** propositalmente (boundary pode disparar antes do login).
- **Stripe**: colunas reservadas. Quando integrar, jamais aplique webhooks em subscriptions com `source='manual'`.

## 8. Como adicionar uma feature ao mapa de uso

```ts
import { trackFeature, useTrackFeature } from "@/hooks/useTrackFeature";

// Visualização de página
useTrackFeature("inbox", "view");

// Ação pontual
trackFeature("kanban", "lead_moved", { entity_id: leadId, metadata: { from, to } });
```

Convenção de `feature`: `inbox | kanban | agent_builder | ai_chat | email_campaign | automation | tracking | forms | admin | builder_wizard | sequences | broadcasts | tasks`.

## 9. Receitas comuns

- **Liberar plano cortesia 30d para uma clínica**: `/admin` → Clínicas → Detalhes → Plano & Assinatura → escolher plano, `expira_em = hoje+30d`, salvar.
- **Registrar pagamento PIX recebido**: `/admin` → Financeiro → "Registrar pagamento / fatura" → status `paid`, método `PIX`, valor, descrição.
- **Anular fatura errada**: tabela de inadimplentes → "Anular".
- **Investigar feature parada**: aba Observabilidade → "Features sem uso há mais de 30 dias".

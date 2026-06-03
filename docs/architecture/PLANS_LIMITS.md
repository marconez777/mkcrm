# Planos & Limites

> **Quando ler:** ao mexer no painel `/admin` (aba Planos / Uso & Limites), ao adicionar uma nova métrica de uso por clínica, ou ao planejar enforcement de cap em runtime.
> **Última atualização:** 2026-06-03
> **Companion:** para o **modelo operacional** (assinaturas, faturas, KPIs financeiros, observabilidade, cron jobs), leia [`docs/maps/BILLING_PLANS.md`](../maps/BILLING_PLANS.md) — este arquivo cobre o **modelo de dados de planos & limites** propriamente dito.

Modelo introduzido em junho/2026 para transformar `clinics.plan` (texto livre) em um **catálogo configurável** de planos com features e limites numéricos, complementado por um sistema de **assinaturas manuais** (`clinic_subscriptions`) e **faturamento manual** (`invoices`).

---

## 1. Tabela `public.plans`

Catálogo único de planos comerciais. Migração `20260603000729_*`.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `code` | text **UNIQUE** | `free` / `starter` / `pro` / `enterprise` (livre — qualquer slug serve) |
| `name` | text | label exibido |
| `description` | text | opcional |
| `price_monthly_brl` | numeric(10,2) | default `0` |
| `price_yearly_brl` | numeric(10,2) | default `0` |
| `features` | jsonb | defaults para `clinics.settings.features` |
| `limits` | jsonb | caps numéricos (ver §3) — `null` ou ausente = ilimitado |
| `sort_order` | int | exibição |
| `is_active` / `is_public` | bool | default `true` |
| `stripe_product_id` / `stripe_price_id_monthly` / `stripe_price_id_yearly` | text | **reservados** — integração Stripe futura, hoje sempre `null` |
| `created_at` / `updated_at` | timestamptz | padrão |

**Seed inicial:** `free`, `starter`, `pro`, `enterprise` (somente `code` + `name`; preços, features e limites são editados via UI).

**GRANTS:**

```sql
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL    ON public.plans TO service_role;
```

`anon` **não** lê — catálogo público de preços usa rota dedicada quando existir.

**RLS:**

- `SELECT` liberado para `authenticated` (todo membro de clínica enxerga o catálogo).
- `INSERT / UPDATE / DELETE` gated por `is_super_admin()`.

---

## 2. Relação com `clinics.settings`

`clinics.settings` continua sendo o JSON-bag de configuração por tenant. Os campos que importam aqui:

```jsonc
{
  "features": { "broadcasts": false, "metrics_ai": true },  // gates de produto
  "limits":   { "max_leads": 5000, "ai_monthly_usd_cap": 50 } // caps numéricos
}
```

Hierarquia de resolução (do mais específico ao default):

```text
clinics.settings.limits.<key>     ← override por clínica (super admin)
        │
        ▼ (se ausente)
plans.limits.<key>                ← default vindo do plano
        │
        ▼ (se ausente)
ilimitado / sem cap
```

A mesma lógica vale para `features`. O trigger `clinics_guard_features` continua bloqueando alterações em `settings.features` para não-super-admin — limites também ficam só sob `is_super_admin()` por hora.

**Coluna `clinics.plan_id`** (FK → `plans(id)`): adicionada como referência forte ao plano corrente. A coluna textual `clinics.plan` permanece como **espelho** mantido pelo trigger `trg_clinics_sync_plan_text` — nunca escreva direto nela.

**Aplicação:** a edge function `admin-apply-plan` cria uma nova `clinic_subscriptions` (`source='manual'`, `is_current=true`, encerrando a anterior), copia `plans.features` + `plans.limits` para `clinics.settings` e atualiza `clinics.plan_id`. `admin-revoke-plan` encerra a corrente e volta para Starter `past_due`.

---

## 2a. Assinaturas manuais (`clinic_subscriptions` + `plan_change_log`)

Modelo introduzido junto com Financeiro. Cada clínica tem **no máximo uma** subscription com `is_current=true` (garantido por índice único parcial).

| Coluna chave | Função |
|---|---|
| `clinic_id`, `plan_id` | tenant + plano vigente |
| `status` | `active` / `trialing` / `manual_grant` / `past_due` / `canceled` |
| `source` | `manual` (hoje único valor real) ou `stripe` (reservado) |
| `is_current` | flag de corrente (único parcial) |
| `trial_ends_at`, `cancel_at`, `canceled_at` | janelas |
| `grant_reason` | livre, mostrado no histórico |
| `stripe_subscription_id` | reservado |

**Triggers:**
- `clinic_subscriptions_validate` — restringe `status`/`source` ao enum textual.
- `clinic_subscriptions_audit` — popula `plan_change_log` (não duplicar inserts).
- `clinic_subscriptions_sync_clinic_plan` — quando `is_current=true`, sincroniza `clinics.plan_id`.

**Cron** `cron-expire-manual-grants` (diário 03:10 UTC): expira `manual_grant`/`trialing` com `cancel_at`/`trial_ends_at` vencido, marca a row corrente como `canceled` e cria nova subscription Starter `past_due`.



## 3. Catálogo de limites (`LIMIT_DEFS`)

Definido em `src/lib/admin-plans.ts`. Renderizado tanto no `PlanEditorDialog` (aba Limites) quanto no `UsageLimitsPanel`.

| Chave | Unidade | Fonte de uso (`USAGE_KEY_MAP`) |
|---|---|---|
| `max_users` | usuários | `members` (count em `clinic_members`) |
| `max_leads` | leads | `leads_total` |
| `max_whatsapp_instances` | conexões | `whatsapp_instances` |
| `max_messages_month` | msgs | `messages_month` |
| `max_broadcasts_month` | broadcasts | `broadcasts_month` |
| `max_emails_month` | e-mails | `emails_month` |
| `max_email_domains` | domínios | `email_domains` |
| `ai_monthly_usd_cap` | USD | `ai_usd_month` (espelha `ai_spend_limits.monthly_cap_usd`) |
| `max_ai_agents` | agentes | `ai_agents` |
| `max_kb_documents` | docs | `kb_documents` (rows em `ai_documents`) |
| `storage_mb` | MB | — (agregado ainda não consultado) |

Convenção: `null` ou chave ausente = **ilimitado**. Zero = bloqueado (use com cuidado).

---

## 4. RPCs de suporte (`SECURITY DEFINER`, gated por `is_super_admin()` em código)

Detalhes em `database/FUNCTIONS_TRIGGERS.md`. Assinaturas reais (migrations `20260603000729_*` e `20260603004725_*`):

- `admin_overview_metrics()` → KPIs cross-tenant do dashboard (clínicas, usuários, leads, mensagens, custo IA mês).
- `admin_top_clinics(_limit int DEFAULT 5)` → ranking por uso recente.
- `admin_clinic_usage(_clinic uuid)` → snapshot agregado de uma clínica (janela fixa "mês corrente" / "all-time").
- `admin_daily_metrics(_days int DEFAULT 30)` → série diária (mensagens, novos leads, custo IA USD).
- `current_clinic_plan(_clinic uuid)` → resolve plano corrente via `clinic_subscriptions.is_current`.

**Financeiro / Observabilidade** (companion `BILLING_PLANS.md`):

- `admin_finance_kpis()` / `admin_revenue_timeseries(_days int)` / `admin_overdue_list()` / `admin_plan_distribution()` — alimentam o `FinancePanel`.
- `admin_feature_usage(_days int)` / `admin_dead_features(_days int)` / `admin_error_summary(_days int)` — alimentam o `ObservabilityPanel`.
- `mark_overdue_invoices()` — chamada pelo cron SQL diário (03:00 UTC) para mover `open → overdue`.

Todas concedem `EXECUTE` a `authenticated`; o gate `is_super_admin()` é feito **dentro** da função (`RAISE EXCEPTION 'forbidden'` caso contrário).

---

## 5. Enforcement

**Fase 1 (atual — junho/2026):** o painel apenas **persiste** os limites e os **exibe** lado a lado com o uso atual. Nenhum ponto de criação (edge function / RPC) bloqueia ainda.

**Fase 2 (roadmap):** wiring em pontos críticos:

- `clinic-create-user`, `clinic-invite` → `max_users`
- import/criação de lead → `max_leads`
- `evolution-connect` → `max_whatsapp_instances`
- `evolution-send` / `evolution-send-media` → `max_messages_month`
- `broadcast-tick` / `broadcast-control` → `max_broadcasts_month`
- `send-email` / `send-email-batch` → `max_emails_month`
- `email-domain-manage` → `max_email_domains`
- `ai-*` (loop principal) → já existe `_shared/spend-guard.ts` para `ai_monthly_usd_cap`; estender para os demais.

Padrão sugerido: helper `_shared/limit-guard.ts` (a criar) que lê `(plans.limits || clinics.settings.limits).<key>`, compara com o uso atual e retorna 402 com payload similar a `SpendLimitExceeded`.

---

## 6. UI

- **`/admin` → aba Planos** — `src/components/admin/PlansPanel.tsx` (lista de cards + `PlanEditorDialog` com tabs Geral/Recursos/Limites).
- **`/admin` → aba Uso & Limites** — `src/components/admin/UsageLimitsPanel.tsx` (tabela clínica × limite × uso × % × badge ok/alerta/excedido).
- **`/admin` → aba Clínicas → Detalhes → "Plano & Assinatura"** — `ClinicDetailsDialog.tsx`: aplicar/revogar plano, definir trial/manual_grant, histórico via `plan_change_log`.
- **`/admin` → aba Financeiro** — `FinancePanel.tsx` (KPIs, gráfico, inadimplentes, distribuição, CRUD via `admin-invoice`).
- **`/admin` → aba Observabilidade** — `ObservabilityPanel.tsx`.

---

## 7. Pegadinhas

- `plans.code` é único e usado como **chave estrangeira lógica** em `clinics.plan` (texto-espelho) — renomear quebra associação. Hoje a FK real é `clinics.plan_id`; ainda assim, mantenha o `code` estável.
- **Nunca escreva em `clinics.plan` diretamente** — mude `clinics.plan_id` (via `admin-apply-plan`) e o trigger `trg_clinics_sync_plan_text` sincroniza.
- **Apenas uma `clinic_subscriptions` `is_current=true` por clínica** (índice único parcial). `admin-apply-plan` já encerra a anterior antes de inserir; não duplique inserts manuais.
- `plan_change_log` é populado por trigger — **não** insira manualmente.
- `admin-apply-plan` **sobrescreve** overrides em `clinics.settings.features|limits` — para preservar override por clínica, faça merge no cliente antes de chamar.
- `ai_monthly_usd_cap` em `plans.limits` é **apenas referência** — o enforcement real continua em `ai_spend_limits.monthly_cap_usd` por clínica. Mantê-los em sincronia é responsabilidade da UI.
- Não exponha `plans` em rotas públicas sem antes filtrar `is_public = true` e remover `limits` sensíveis.
- Colunas `stripe_*` em `plans`, `clinic_subscriptions` e `invoices` estão **reservadas** — quando integrar Stripe, jamais aplique webhooks em subscriptions com `source='manual'`.

---

## 8. Cross-links

- `maps/BILLING_PLANS.md` — **mapa operacional** de planos/financeiro/observabilidade (companion deste arquivo).
- `architecture/FEATURE_FLAGS.md` — relação `plans.features` ↔ `clinics.settings.features`.
- `architecture/SUPER_ADMIN.md` — gate `is_super_admin()`, painéis, RLS.
- `operations/COSTS_LIMITS.md` — caps de email que continuam **fora** de `plans.limits`.
- `database/SCHEMA.md` — blocos `plans`, `clinic_subscriptions`, `plan_change_log`, `invoices`, `payment_receipts`.
- `edge-functions/INDEX.md` — `admin-users-list`, `admin-user-action`, `admin-apply-plan`, `admin-revoke-plan`, `admin-invoice`, `cron-expire-manual-grants`.

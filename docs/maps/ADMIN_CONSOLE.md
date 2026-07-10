---
title: "Admin Console"
topic: admin
kind: map
audience: agent
updated: 2026-07-01
summary: "Portal super-admin: shell, guardas, rotas, painéis e edge functions administrativas (usuários, clínicas, planos, faturas, integrações, auditoria)."
code_refs:
  - src/layouts/AdminShell.tsx
  - src/pages/admin/
  - src/components/admin/
  - supabase/functions/admin-user-action/
  - supabase/functions/admin-users-list/
  - supabase/functions/admin-apply-plan/
  - supabase/functions/admin-revoke-plan/
  - supabase/functions/admin-delete-clinic/
  - supabase/functions/admin-invoice/
related_docs:
  - docs/maps/BILLING.md
  - docs/maps/FRONTEND_CORE.md
---

# Admin Console

Última auditoria: Fase 10 do roadmap **F-DOC-FULL**.

Área super-admin do Chat Funnel AI: portal isolado, rota base `/admin`,
autenticação separada, sidebar dedicada e code-split (lazy imports em
`src/App.tsx` linhas 25–42). Somente usuários com `user_roles.role =
'super_admin'` acessam.

---

## 1. Roteamento & shell

### 1.1 Rotas (`src/App.tsx` 119–137)

```text
/admin/login                         → AdminLogin (fora do shell)
/admin                               → AdminShell (Outlet)
  ├── /admin                         → AdminDashboard (index)
  ├── /admin/clinics                 → AdminClinics
  ├── /admin/users                   → AdminUsers
  ├── /admin/plans                   → AdminPlans        (AdminPanels)
  ├── /admin/usage                   → AdminUsage
  ├── /admin/finance                 → AdminFinance
  ├── /admin/observability           → AdminObservability
  ├── /admin/support                 → AdminSupport
  ├── /admin/integrations            → AdminIntegrations
  ├── /admin/integrations/eduzz      → AdminEduzz
  ├── /admin/audit                   → AdminAudit
  ├── /admin/builder-manual          → AdminBuilderManual
  ├── /admin/branding                → AdminBranding
  ├── /admin/pipeline-automations    → AdminPipelineAutomations
  └── /admin/pipeline-health         → AdminPipelineHealth
```

Todas em `<Suspense fallback={<AdminFallback/>}>` para preservar bundle
principal.

### 1.2 `AdminShell` (`src/layouts/AdminShell.tsx`)

- **Guarda**: `useAuth() → { session, isSuperAdmin, loading }`. Sem sessão
  OU sem `is_super_admin` → `<Navigate to="/admin/login" replace />`.
- **Branding dinâmico**: `useBrandingSync` lê `app_settings.platform_branding`
  e injeta CSS vars (`--admin-primary`, `--admin-accent`, `--admin-positive`,
  `--admin-negative`) em `document.documentElement`.
- **Sidebar** — 5 grupos: Visão Geral, Clientes, Receita, Operações,
  Plataforma. Colapsável (68px/244px), persistência local via state.
- **Topbar**: breadcrumb, `Cmd/Ctrl+K` abre `AdminCommandPalette`, toggle
  dark, sino de notificação, "Voltar ao app", "Sair".
- **Theme**: toggle `.dark` no `<html>`; sincroniza com preferência atual.
- Exporta `AdminPageHeader` reutilizado por todas as sub-páginas.

### 1.3 `AdminLogin`

Página pública dedicada (123 LOC). Login por email+senha, redireciona para
`/admin` após validar `is_super_admin`. Não usa fluxo de Auth do app
principal (evita colisão com onboarding/ClinicOnlyRoute).

---

## 2. Painéis (páginas)

### 2.1 `AdminDashboard` (14 LOC + `DashboardPanel`)

Consome RPC `admin_overview_metrics()` (migration
`20260603000729_*.sql`) — retorna JSON com contagens de clínicas
(total/active/suspended/novas 30d), users (total/novos 30d) e mensagens 30d
(inbound/outbound). Requer `is_super_admin()`.

### 2.2 `AdminClinics` (624 LOC)

Maior página do admin. Lista todas as clínicas com colunas de plano, MRR,
status, uso vs limite. Ações:
- **Ver detalhes** → `ClinicDetailsDialog` (usage, integrações, membros).
- **Gerar Convite** → Invoca edge function `clinic-invite` para gerar link de acesso à empresa.
- **Aplicar plano** → `admin-apply-plan`.
- **Revogar plano** → `admin-revoke-plan`.
- **Suspender/Ativar** → UPDATE direto em `clinics.status`.
- **Excluir empresa** → `admin-delete-clinic` (requer `confirm_slug`).

### 2.3 `AdminUsers` + `UsersPanel`

- Pagina via `admin-users-list` (server-side pagination, join com
  `profiles`, `clinic_members`, `user_roles`, `auth_lockouts`,
  `admin_get_last_seen` RPC).
- `last_seen_at` = MAX(`auth.sessions.updated_at`) — reflete refresh de
  token, não só login.
- Ações via `admin-user-action`: `set_password`, `disable`, `enable`,
  `delete`, `send_recovery`, `remove_from_clinic`, `set_role`, etc.

### 2.4 `AdminPanels.tsx` (agregador — 104 LOC)

Cada export é um wrapper de `AdminPageHeader` + Panel:

| Página              | Painel principal                                      |
| ------------------- | ----------------------------------------------------- |
| AdminPlans          | `PlansPanel` (CRUD de `public.plans`)                 |
| AdminUsage          | `UsageLimitsPanel` (uso real vs `clinics.settings.limits`) |
| AdminFinance        | `FinancePanel` (MRR/ARR, faturas via `admin-invoice`) |
| AdminObservability  | `ObservabilityPanel` (feature_events, error_events)   |
| AdminSupport        | `SupportPanel` + `SupportLiveMonitor` + `SupportTelemetry` + `SupportPinsCard` |
| AdminAudit          | `AuditPanel` (`audit_log` filtrado por clínica)       |
| AdminBuilderManual  | `BuilderManualPanel` (edita `builder_manual_versions`) |
| AdminIntegrations   | `IntegrationsKeysCard` + `IntegrationsDomainsTable` + `IntegrationsQuotaTable` |

`AdminAudit` e `AdminIntegrations` pré-carregam `clinics(id,name)` via
`fetchAllPaged` para popular filtros.

### 2.5 `AdminBranding` (205 LOC)

Editor whitelabel: paleta (`--admin-primary/accent/positive/negative`),
logo, favicon. Grava em `app_settings.platform_branding` (chave única).
Preview em tempo real via CSS vars.

### 2.6 `AdminEduzz` (197 LOC)

Painel dedicado ao webhook Eduzz — histórico de `eduzz_purchases`, matching
manual de compras a clínicas, configuração de secret por plan_code. Ver
`docs/maps/BILLING.md` §3.

### 2.7 `AdminPipelineAutomations` (239 LOC)

Allowlist de automações do pipeline (`pipeline_automation_allowlist`):
quais clínicas participam do motor determinístico automatizado. Grava/
remove entries e toggla `dry_run`.

### 2.8 `AdminPipelineHealth` (331 LOC)

Cockpit de saúde do runtime IA:
- `PipelineErrorsCard` — RPC `admin_pipeline_errors_paginated` (deduplica
  leads com erro, permite retry manual/em massa via `pipeline-run-executor`).
- `ProviderHealthCard` — `pipeline_provider_health` (quota Gemini/OpenAI,
  fallback).
- `AutoRetryRecoveryCard` — status do `pipeline-auto-retry`.
- `AiSpendLimitCard` — limites em `ai_spend_limits`, notificações em
  `ai_spend_notifications_sent`.

Ver `docs/maps/PIPELINE_RUNTIME.md`.

---

## 3. Componentes reutilizáveis (`src/components/admin/`)

| Componente                    | Propósito                                              |
| ----------------------------- | ------------------------------------------------------ |
| `AdminCommandPalette`         | Cmd+K — navegação rápida e ações super-admin           |
| `ClinicDetailsDialog`         | Modal de detalhes + edição inline de settings/limits   |
| `PlansPanel`                  | CRUD de `plans` com preview de features/limits         |
| `UsageLimitsPanel`            | Grid de uso vs limite por clínica                      |
| `FinancePanel`                | MRR/ARR/inadimplência + tabela de `invoices`           |
| `ObservabilityPanel`          | Uso por feature, erros agregados, features sem uso     |
| `SupportPanel`, `SupportLiveMonitor`, `SupportTelemetry`, `SupportPinsCard` | Monitor do agente Alfred (KB, threads, feedback) |
| `AuditPanel`                  | Timeline de `audit_log` por clínica/ator/action        |
| `BuilderManualPanel`          | Editor do manual usado pelo Construtor de Agentes      |
| `IntegrationsKeysCard`        | Rotate/rotate visualização de chaves globais (Lovable, Resend, etc.) |
| `IntegrationsDomainsTable`    | `email_domains` × DNS status                           |
| `IntegrationsQuotaTable`      | Cotas por integração (Gemini/OpenAI/Resend)            |
| `DashboardPanel`              | Cards + gráficos do `admin_overview_metrics`           |
| `PipelineErrorsCard`, `ProviderHealthCard`, `AutoRetryRecoveryCard`, `AiSpendLimitCard` | Ver §2.8 |

---

## 4. Edge functions (`supabase/functions/admin-*/`)

Padrão comum em TODAS: valida `Authorization: Bearer` → resolve user →
consulta `user_roles.role='super_admin'` via service role → 403 se não for.

| Função                | Ação                                                        | LOC |
| --------------------- | ----------------------------------------------------------- | --- |
| `admin-users-list`    | GET paginado (`page`, `per_page`, `search`) — usa `auth.admin.listUsers` + joins locais | 107 |
| `admin-user-action`   | POST `{action, user_id, ...}` — set_password, disable, enable, delete, send_recovery, set_role, remove_from_clinic | 93 |
| `clinic-invite`       | POST `{clinic_id, email, role}` — Gera link de convite único restrito ao e-mail, salva em `clinic_invites` | 72 |
| `admin-apply-plan`    | POST batch — aplica plano a `clinic_ids[]`, cancela sub anterior, insere `clinic_subscriptions`, grava `audit_log` | 125 |
| `admin-revoke-plan`   | POST — cancela sub atual, insere fallback (`starter` default) `past_due`, sobrescreve `clinics.plan_id` | 67 |
| `admin-delete-clinic` | POST — deleta membros (apaga `auth.user` se membro único), depois CASCADE em `clinics` | 123 |
| `admin-invoice`       | POST `{action: create\|mark_paid\|void\|delete, ...}` sobre `invoices` | 87 |

Todos gravam em `audit_log` quando modificam estado sensível.

---

## 5. Segurança & guardas

1. **Client-side**: `AdminShell` bloqueia render sem `isSuperAdmin`. **Isso
   é apenas UX** — sensível fica no backend.
2. **Server-side**: cada edge function admin faz check duplo (auth →
   role). RPCs sensíveis (`admin_overview_metrics`, `admin_get_last_seen`)
   têm `SECURITY DEFINER` + `is_super_admin()` guard.
3. **RLS** em `plans`, `plan_change_log`, `audit_log`, `clinic_subscriptions`
   só permite escrita via super admin ou service role.
4. **`AdminLogin`** é a única rota `/admin/*` publicamente acessível.
5. **`app_settings.platform_branding`** — RLS restringe UPDATE a super
   admin, SELECT liberado (necessário para o shell ler ao logar).

---

## 6. Pontos de atenção

1. `AdminClinics` (624 LOC) concentra muita lógica — refactor pendente
   para split em cards/tabs.
2. `admin-users-list` usa `auth.admin.listUsers` (paginação in-memory de
   até 200/página) — não escala para >10k usuários sem cursor real.
3. Guarda `AdminShell` depende de `isSuperAdmin` no hook `useAuth` — se
   `user_roles` mudar (revogação), o admin permanece na UI até refresh.
   Considerar `refetch` após ações sensíveis.
4. `admin-invoice` grava em `invoices` mas **não** sincroniza com o Stripe
   nem com `clinic_subscriptions` — divergência possível se a fatura for
   marcada como paga manualmente enquanto o Stripe está past_due.
5. `admin-delete-clinic` faz best-effort (loop de membros); em concorrência
   com signups, um usuário criado no meio pode ficar órfão.
6. `AdminCommandPalette` navega mas não expõe todas as ações destrutivas —
   somente as que têm rota. Ações via edge function (delete-clinic,
   set_password) exigem UI explícita.

---

Fase 10 concluída. Próxima: **Fase 11 (Storage / Uploads / Assets)**.

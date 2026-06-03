# Contas no Admin & Sistema de Limitação por Conta

> **Quando ler:** ao mexer em criação/convite de usuários no `/admin`, no catálogo de planos, em overrides de limite por clínica, ou ao implementar enforcement em runtime.
> **Última atualização:** 2026-06-03
> **Audiência:** dev fullstack que vai editar o pipeline. Para o "porquê" do papel super_admin, leia [`docs/architecture/SUPER_ADMIN.md`](../architecture/SUPER_ADMIN.md). Para o modelo de planos puro, leia [`docs/architecture/PLANS_LIMITS.md`](../architecture/PLANS_LIMITS.md).

---

## TL;DR

Há **dois eixos** entrelaçados:

1. **Conta** = `auth.users` (Supabase Auth) + `profiles` + vínculo `clinic_members` a UMA `clinic`. O papel global `super_admin` mora em `user_roles` (separado por segurança).
2. **Limites** = tudo que a clínica pode consumir. Vivem no `plans` (default) e em `clinics.settings.limits` (override por clínica). Hoje a maior parte é **apenas exibida**; enforcement real só existe para gasto de IA (`spend-guard`).

Fluxo típico no `/admin`:

```text
super_admin ──► UsersPanel ──► clinic-create-user / clinic-invite ──► auth.users + profile + clinic_member
                                                          │
                                                          └──► (futuro) checa max_users do plano da clínica

super_admin ──► PlansPanel ──► CRUD plans (features + limits)
super_admin ──► ClinicDetailsDialog ──► admin-apply-plan ──► clinic_subscriptions + clinics.settings
super_admin ──► UsageLimitsPanel ──► leitura admin_clinic_usage RPC (snapshot)
```

---

## FASE 1 — Criação de contas (estado atual)

### 1.1 Pontos de entrada (UI)

| Local | Componente | Ação | Edge function |
|---|---|---|---|
| `/admin` → aba Usuários | `src/components/admin/UsersPanel.tsx` | "Novo usuário" (form modal) | `clinic-create-user` |
| `/admin` → aba Usuários | `src/components/admin/UsersPanel.tsx` | "Convidar por e-mail" | `clinic-invite` |
| `/admin` → Clínica → detalhe | `src/components/admin/ClinicDetailsDialog.tsx` | troca de plano, revogar | `admin-apply-plan`, `admin-revoke-plan` |
| `/admin` → aba Usuários | `UsersPanel.tsx` | ban / unban / promote / reset / sign_out / delete | `admin-user-action` |
| Self-signup `/auth` | `src/pages/Auth.tsx` | usuário cria a própria conta | nenhum (Supabase Auth direto) — onboarding cria a clínica |

> Não há "self-signup como super_admin". A promoção é manual via `admin-user-action`.

### 1.2 Caminho exato — "Criar usuário diretamente"

`POST /functions/v1/clinic-create-user` (corpo `{ email, password, full_name, role, clinic_id? }`):

1. Verifica Bearer → `supabase.auth.getUser()` → `callerId`.
2. Authoriza: precisa ser `super_admin` (lookup em `user_roles`) **ou** `owner`/`admin` em `clinic_members`.
3. Se super_admin, `clinic_id` no body é obrigatório; se clinic admin, herda o `clinic_id` do próprio vínculo.
4. `supabase.auth.admin.createUser({ email, password, email_confirm: true })` — cria a conta **já confirmada** (login imediato).
5. `upsert` em `profiles` (`user_id`, `email`, `full_name`).
6. `upsert` em `clinic_members` com `role ∈ { owner | admin | professional | viewer }` (default `professional`). `onConflict: "user_id"` → **um usuário só pode estar em uma clínica por vez** (mover = upsert).
7. Retorna `{ ok: true, user_id }`.

**Triggers relevantes** (banco):
- `handle_new_user` em `auth.users` insere a row inicial em `profiles` — o `upsert` do passo 5 cobre o caso de race/ausência.
- Nenhum trigger checa limite de assentos hoje.

### 1.3 Caminho exato — "Convidar por e-mail"

`POST /functions/v1/clinic-invite`:

1. Mesmo gate (super_admin ou clinic admin/owner da clínica alvo).
2. Cria/atualiza row em `clinic_invites` com `token` aleatório.
3. Dispara e-mail via gateway Resend (`GATEWAY_URL`) com link para `/invite?token=...`.
4. Página `src/pages/Invite.tsx` consome o token, cria/loga a conta e adiciona em `clinic_members`.

### 1.4 Ações pós-criação (`admin-user-action`)

Body `{ action, user_id, ... }`. Ações suportadas:

| action | Efeito |
|---|---|
| `promote` | Insere `('super_admin', user_id)` em `user_roles`. |
| `demote` | Remove role `super_admin`. |
| `ban` | Seta `banned_until` longe; sessão expira. |
| `unban` | Limpa `banned_until`. |
| `reset_password` | Gera magic link de reset. |
| `sign_out` | `auth.admin.signOut(user_id)` — invalida refresh tokens. |
| `delete` | `auth.admin.deleteUser` + cascade em `profiles`/`clinic_members`. |

Toda ação grava em `audit_log` (`actor_id`, `action`, `target_user_id`, `target_clinic_id`).

### 1.5 Invariantes da criação

1. **Role `super_admin` nunca em `profiles`/coluna direta** — sempre `user_roles` + função `has_role()` SECURITY DEFINER.
2. **Senha mínima 8 chars** (validada na edge — frontend é só UX).
3. **`email_confirm: true`** na criação direta — não enviar magic link separado.
4. **Vínculo 1 user ↔ 1 clínica** (constraint lógico via `onConflict: user_id` em `clinic_members`).
5. **Toda ação de auth sensível re-checa role no servidor** — `isSuperAdmin` no front é só UX.

---

## FASE 2 — Catálogo de planos e limites

### 2.1 Tabelas

| Tabela | Função |
|---|---|
| `plans` | Catálogo (`code`, `name`, `features` jsonb, `limits` jsonb, `price_monthly_brl`). Único registro por `code`. |
| `clinics` | `plan` (text → `plans.code`), `plan_id` (uuid → `plans.id`), `settings` jsonb (features/limits override). |
| `clinic_subscriptions` | Histórico de planos atribuídos. `is_current=true` aponta para o ativo. Campos: `status`, `source` (`stripe`/`manual`), `trial_ends_at`, `cancel_at`, `granted_by`, `grant_reason`. |
| `plan_change_log` | Log imutável de mudanças (from_plan_id → to_plan_id, from_status → to_status, reason). |
| `ai_spend_limits` | `monthly_cap_usd` por clínica (único limite com enforcement real hoje). |
| `usage_counters` | Contadores correntes (mensagens/mês, etc) — alimenta `admin_clinic_usage`. |
| `audit_log` | Toda ação sensível. |

### 2.2 Catálogo de limites (`src/lib/admin-plans.ts`)

`LIMIT_DEFS` é a fonte canônica. Cada chave tem:
- `key` — usado em `plans.limits` e `clinics.settings.limits`.
- `label` — exibido na UI.
- `USAGE_KEY_MAP[key]` — nome do campo no payload de `admin_clinic_usage` (uso atual).

| Key | Unidade | Usage source |
|---|---|---|
| `max_users` | usuários | `members` |
| `max_leads` | leads | `leads_total` |
| `max_whatsapp_instances` | instâncias | `whatsapp_instances` |
| `max_messages_month` | msgs | `messages_month` |
| `max_broadcasts_month` | broadcasts | `broadcasts_month` |
| `max_emails_month` | e-mails | `emails_month` |
| `max_email_domains` | domínios | `email_domains` |
| `ai_monthly_usd_cap` | USD | `ai_usd_month` |
| `max_ai_agents` | agentes | `ai_agents` |
| `max_kb_documents` | docs | `kb_documents` |
| `storage_mb` | MB | (não consultado) |

Convenção: `null` ou ausente = **ilimitado**. `0` = **bloqueado** (use com cuidado).

### 2.3 Hierarquia de resolução

```text
clinics.settings.limits.<key>   ← override por clínica (só super_admin escreve)
        │ (se ausente / null)
        ▼
plans.limits.<key>              ← default vindo do plano da clínica
        │ (se ausente / null)
        ▼
ilimitado
```

`UsageLimitsPanel.effectiveLimit()` implementa essa cascata literal — qualquer enforcement futuro deve usar a **mesma** lógica (extrair para `_shared/limit-guard.ts`).

### 2.4 Aplicação de plano (`admin-apply-plan`)

Body: `{ plan_code, clinic_ids[], overwrite_features=true, overwrite_limits=true, trial_days?, expires_at?, grant_reason?, status? }`.

Para cada clínica:
1. Lê `plans` por `code`.
2. `UPDATE clinics SET plan_id, settings` (sobrescreve `features`/`limits` se `overwrite_*=true`).
3. `UPDATE clinic_subscriptions SET is_current=false, canceled_at=now()` no atual.
4. `INSERT` nova subscription com `source='manual'`, `granted_by=callerId`, `trial_ends_at`, `cancel_at=expires_at`.

> Trigger `plan_change_log_trigger` em `clinic_subscriptions` grava em `plan_change_log` automaticamente.

**`admin-revoke-plan`** faz o caminho inverso aplicando um `fallback_plan_code` (default `starter`).

### 2.5 Enforcement (estado atual)

| Limite | Enforcement | Onde |
|---|---|---|
| `ai_monthly_usd_cap` | ✅ Bloqueia chamada IA com 402 | `supabase/functions/_shared/spend-guard.ts` via RPC `check_ai_spend_status` |
| Todos os demais | ❌ Apenas exibidos | `UsageLimitsPanel` mostra badge ok/alerta/excedido |

Snapshot via RPC `admin_clinic_usage(_clinic uuid)` (SECURITY DEFINER, gate `is_super_admin()` no body). Janela e métricas fixas no SQL — não aceita parâmetros adicionais.

---

## FASE 3 — Roadmap de enforcement (a implementar)

Padrão recomendado: criar `supabase/functions/_shared/limit-guard.ts` espelhando `spend-guard`:

```ts
export class LimitExceeded extends Error { status = 402; constructor(public body: any){ super(body.error); } }

export async function assertLimit(clinicId: string, key: string, currentDelta = 1) {
  // 1. resolve effective limit (settings override → plan default → null = unlimited)
  // 2. lê uso atual via admin_clinic_usage ou contadora dedicada
  // 3. throw LimitExceeded({ error: 'limit_reached', key, used, limit })
}
```

Wiring por limite:

| Limite | Edge function / ponto | Quando chamar |
|---|---|---|
| `max_users` | `clinic-create-user`, `clinic-invite` | Antes do `auth.admin.createUser` / `clinic_invites.insert` |
| `max_leads` | `tracking-event` (lead novo), import CSV, `evolution-sync-lead` | Antes do `insert` em `leads` |
| `max_whatsapp_instances` | `evolution-provision` | Antes do create remoto |
| `max_messages_month` | `evolution-send`, `evolution-send-media` | Antes do send (contador incrementa pós-success) |
| `max_broadcasts_month` | `broadcast-control` (start) | Antes de marcar broadcast como running |
| `max_emails_month` | `send-email`, `dispatch-campaign` | Antes do enqueue |
| `max_email_domains` | `email-domain-manage` | Antes do create |
| `max_ai_agents` | `ai-builder` (create) | Antes do insert em `ai_agents` |
| `max_kb_documents` | `ai-ingest-*` | Antes do insert em `ai_documents` |
| `storage_mb` | upload de mídia (Storage hook) | Trigger SQL ou edge proxy |

Cada bloqueio deve retornar 402 com payload `{ error, key, used, limit }` para o front exibir toast amigável.

---

## FASE 4 — UI: onde editar o quê

### 4.1 Mapa de componentes admin

```text
src/pages/Admin.tsx                                  ← shell, tabs, gate de role
├── components/admin/DashboardPanel.tsx              ← KPIs cross-tenant (admin_overview_metrics)
├── components/admin/UsersPanel.tsx                  ← CRUD de contas (clinic-create-user, clinic-invite, admin-user-action)
├── components/admin/PlansPanel.tsx                  ← CRUD do catálogo plans + PlanEditorDialog
├── components/admin/UsageLimitsPanel.tsx            ← tabela clínica × limite × uso (informativo)
├── components/admin/ClinicDetailsDialog.tsx         ← detalhe por clínica: plano atual, aplicar/revogar, histórico
├── components/admin/AiSpendLimitCard.tsx            ← cap mensal IA por clínica (único enforcement live)
├── components/admin/IntegrationsKeysCard.tsx        ← chaves globais (Evolution/Resend)
├── components/admin/IntegrationsDomainsTable.tsx    ← domínios verificados
├── components/admin/IntegrationsQuotaTable.tsx      ← quotas usadas vs disponíveis
├── components/admin/AuditPanel.tsx                  ← audit_log paginado
├── components/admin/BuilderManualPanel.tsx          ← manual do Builder (versionado)
├── components/admin/FinancePanel.tsx                ← assinaturas + faturas
└── components/admin/ObservabilityPanel.tsx          ← logs/erros agregados
```

### 4.2 Mapa de bibliotecas

| Arquivo | Conteúdo |
|---|---|
| `src/lib/admin-plans.ts` | `LIMIT_DEFS`, `USAGE_KEY_MAP` — **adicionar novo limite começa aqui** |
| `src/lib/features.ts` | `FEATURES` (chave + label) — feature flags |
| `src/hooks/useAuth.tsx` | Sessão + `isSuperAdmin` + refresh resiliente |
| `src/components/ProtectedRoute.tsx` | Gate genérico de rota |
| `src/components/FeatureRoute.tsx` | Gate por `features.<key>` |

### 4.3 Mapa de edge functions

```text
supabase/functions/
├── admin-users-list/            ← lista cross-tenant (paginação + busca)
├── admin-user-action/           ← promote/demote/ban/unban/reset/sign_out/delete
├── admin-apply-plan/            ← atribui plano + cria subscription manual
├── admin-revoke-plan/           ← reverte para fallback_plan_code
├── admin-invoice/               ← geração/listagem de faturas (super_admin)
├── clinic-create-user/          ← cria conta direta (super_admin ou clinic admin)
├── clinic-invite/               ← convida por e-mail
├── cron-expire-manual-grants/   ← job: encerra trials/grants vencidos
└── _shared/spend-guard.ts       ← TEMPLATE para limit-guard.ts (Fase 3)
```

### 4.4 Mapa de migrations relevantes

```text
supabase/migrations/
├── 20260603000729_*  ← cria public.plans + seeds free/starter/pro/enterprise
├── 20260603004725_*  ← RPCs admin_overview_metrics, admin_clinic_usage, admin_top_clinics, admin_daily_metrics
├── 20260506212550_*  ← ai_spend_limits + check_ai_spend_status
├── 20260507204807_*  ← usage_counters + triggers
├── 20260525180807_*  ← usage_limits (overrides legados)
└── 20260527222206_*  ← clinic_subscriptions + plan_change_log + triggers
```

---

## FASE 5 — Receitas práticas

### 5.1 Adicionar um novo limite (ex: `max_pipelines`)

1. `src/lib/admin-plans.ts` → adiciona `{ key: "max_pipelines", label: "Pipelines", unit: "pipelines" }` em `LIMIT_DEFS` e `max_pipelines: "pipelines"` em `USAGE_KEY_MAP`.
2. Migration: adiciona o campo `pipelines` no SELECT de `admin_clinic_usage` (count em `pipelines` filtrado por `clinic_id`).
3. UI já renderiza (`PlansPanel` e `UsageLimitsPanel` leem `LIMIT_DEFS` dinamicamente).
4. (Fase 3) Wire `assertLimit(clinicId, 'max_pipelines')` na criação de pipeline.
5. Atualize defaults em `plans` via migration `UPDATE plans SET limits = limits || '{"max_pipelines": N}'::jsonb`.
6. Documente em `docs/architecture/PLANS_LIMITS.md` §3.

### 5.2 Adicionar uma nova ação em usuário (ex: "exportar dados")

1. `supabase/functions/admin-user-action/index.ts` → adiciona case `'export'`.
2. `src/components/admin/UsersPanel.tsx` → adiciona item no `DropdownMenu`.
3. Auditoria: `INSERT INTO audit_log` no início do case.

### 5.3 Aplicar um plano para várias clínicas em lote

1. UI: `PlansPanel` → "Aplicar a clínicas..." (a implementar) chama `admin-apply-plan` com array de `clinic_ids`.
2. Confirmar destrutividade (sobrescreve overrides) com `overwrite_features`/`overwrite_limits` toggles.

### 5.4 Criar uma conta de teste rápido

1. `/admin` → Usuários → Novo usuário.
2. Selecionar clínica + role `professional`.
3. Senha mínima 8. Conta nasce confirmada — login imediato em `/auth`.

### 5.5 Promover alguém para super_admin

1. `/admin` → Usuários → menu da linha → "Promover".
2. Confirma → `admin-user-action` insere em `user_roles`.
3. Usuário precisa relogar para `isSuperAdmin` refletir no front.

### 5.6 Trocar plano sem trial nem expiração

`admin-apply-plan` com `{ plan_code, clinic_ids: [...], status: 'manual_grant' }` (default).

### 5.7 Conceder trial de 14 dias

`{ plan_code: 'pro', clinic_ids: [id], trial_days: 14, grant_reason: 'PoC cliente X' }` → cria subscription `status='trialing'`, `trial_ends_at` em 14d. Job `cron-expire-manual-grants` reverte ao expirar.

---

## FASE 6 — Pegadinhas & invariantes

1. **`admin-apply-plan` sobrescreve overrides** em `clinics.settings.features|limits`. Se o cliente tem override custom, faça merge no payload antes de chamar (ou marque `overwrite_features=false`).
2. **`plans.code` é chave estrangeira lógica** em `clinics.plan`. Renomear quebra associação — fazer `UPDATE clinics SET plan='novo' WHERE plan='antigo'` na mesma migration.
3. **`ai_monthly_usd_cap` em `plans.limits` é apenas referência** — enforcement real está em `ai_spend_limits.monthly_cap_usd`. Sincronizar manualmente (ou via trigger futuro).
4. **Não exponha `plans` em rota pública** sem filtrar `is_public=true` e remover `limits` sensíveis.
5. **`clinic_members` é 1:1 user→clínica** hoje. Para multi-clínica precisa quebrar `onConflict: user_id` em `clinic-create-user`.
6. **`super_admin` é global**, atravessa toda RLS via `has_role(auth.uid(),'super_admin')` no `OR` das policies. Tabela nova sem esse `OR` = super_admin perde visão cross-tenant.
7. **Senha forte é responsabilidade do servidor** — front pode validar, edge re-valida (>=8 hoje; subir para 12 + complexidade quando endurecer).
8. **`email_confirm: true`** no createUser pula verificação — só usar em criação admin, nunca em self-signup.
9. **Refresh token perdido** = sessão silenciosa cai para anon → RPC admin retorna 400. `useAuth.handleSessionLost` força logout — não tente "auto-recuperar".
10. **Auditoria obrigatória** em: promote/demote, ban/unban, delete user, apply/revoke plan, rotação de chave global.

---

## FASE 7 — Debug rápido

| Sintoma | Checar |
|---|---|
| "Aplicar plano" mostra sucesso mas nada muda | DevTools → Network → `admin-apply-plan` 200? `admin_clinic_usage` 400 logo após = sessão caída |
| Super_admin não vê dados de outra clínica | RLS da tabela tem `OR has_role(auth.uid(),'super_admin')`? Row em `user_roles` existe? |
| Usuário novo não loga | `email_confirm` setado? `profiles` tem row? `clinic_members` tem vínculo? |
| Limite ignorado | Limite efetivo é null? (cascata caiu até "ilimitado"). Fase de enforcement = só `ai_monthly_usd_cap` |
| Convite não chega | `clinic_invites` row existe? Resend conector OK em IntegrationsKeysCard? |

---

## Cross-links

- [`architecture/SUPER_ADMIN.md`](../architecture/SUPER_ADMIN.md) — fonte canônica do papel.
- [`architecture/PLANS_LIMITS.md`](../architecture/PLANS_LIMITS.md) — modelo de planos puro (sem o eixo "conta").
- [`architecture/FEATURE_FLAGS.md`](../architecture/FEATURE_FLAGS.md) — `plans.features` ↔ `clinics.settings.features`.
- [`maps/ADMIN_SUPER_ADMIN.md`](../maps/ADMIN_SUPER_ADMIN.md) — mapa rápido do `/admin`.
- [`maps/BILLING_PLANS.md`](../maps/BILLING_PLANS.md) — Stripe + subscriptions.
- [`edge-functions/INDEX.md`](../edge-functions/INDEX.md) — catálogo completo de functions.
- [`database/RLS_POLICIES.md`](../database/RLS_POLICIES.md) — padrão tenant + bypass super_admin.
- [`operations/COSTS_LIMITS.md`](../operations/COSTS_LIMITS.md) — caps de e-mail fora de `plans.limits`.

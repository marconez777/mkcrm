
# Painel Super Admin v2

Hoje `/admin` tem 3 abas: **Clínicas**, **Integrações**, **Manual do Builder**. A coluna `clinics.plan` existe (texto livre, default `free`) mas não está ligada a limites — quem controla recursos é `clinics.settings.features` (jsonb) + `ai_spend_limits` por clínica. Não existe nenhuma tabela de catálogo de planos nem visão consolidada de usuários/uso.

A proposta reorganiza o painel em **6 abas** e introduz um catálogo de planos reutilizável.

## Nova navegação

```text
/admin
 ├─ Dashboard       (visão geral — novo)
 ├─ Clínicas        (existente, enriquecida)
 ├─ Usuários        (novo)
 ├─ Planos          (novo — catálogo configurável)
 ├─ Uso & Limites   (novo)
 ├─ Integrações     (existente)
 └─ Auditoria       (novo)
```

## 1. Dashboard (novo)

Cards e mini-gráficos no topo:

- **Clínicas:** total / ativas / suspensas / novas nos últimos 30d
- **Usuários:** total / ativos nos últimos 7d / novos no mês (via `profiles` + `clinic_members` + `last_sign_in_at` quando exposto)
- **Mensagens WhatsApp (30d):** enviadas / recebidas / falhas (de `messages`)
- **IA (30d):** custo total USD, tokens, requisições (de `ai_usage_daily`)
- **Email (30d):** enviados / abertos / cliques (de `email_metrics_daily`)
- **Leads (30d):** novos / convertidos
- **Top 5 clínicas por uso** (mensagens + custo IA)
- **Saúde:** clínicas acima do `ai_spend_limits.monthly_cap_usd` / instâncias WhatsApp desconectadas

Tudo agregado via RPCs novos `admin_metrics_*` (security definer, gated por `is_super_admin()`), para não puxar mil linhas pro browser.

## 2. Clínicas (enriquecida)

Mantém tudo que já existe (criar, convite, criar usuário, recursos, suspender) e adiciona:

- Coluna **Plano** vira `Select` (lista de `plans.code`) em vez de texto solto
- Coluna **Membros** (count de `clinic_members`)
- Coluna **Último acesso** (max `last_sign_in_at` dos membros)
- Coluna **Uso do mês** (mensagens + USD IA)
- Botão **"Detalhes"** → drawer com timeline de uso, lista de membros, status WhatsApp, gasto IA do mês

## 3. Usuários (novo)

Tabela cross-tenant de todos os usuários cadastrados:

- Colunas: avatar/nome, email, clínica, papel, super admin?, criado em, último login, status (ativo/bloqueado em `auth_lockouts`)
- Filtros: por clínica, por papel, por status, busca por email/nome
- Ações por linha:
  - Mover de clínica / mudar papel
  - Promover / revogar super admin (`user_roles`)
  - Resetar senha (gera link mágico via edge `admin-user-reset`)
  - Desbloquear conta (`DELETE FROM auth_lockouts` via edge)
  - Forçar logout (revogar refresh tokens)
- Botão **"Criar usuário"** (reaproveita edge `clinic-create-user`)

Edge function nova `admin-users-list` (paginada, busca em `auth.users` + join com `profiles`, `clinic_members`, `user_roles`, `auth_lockouts`), pois o frontend não pode ler `auth.users`.

## 4. Planos (novo — catálogo)

Hoje `clinics.plan` é texto livre. Vira FK lógica para uma nova tabela `plans` editável:

```text
plans
 ├─ code         (free, starter, pro, enterprise) — único
 ├─ name, description, sort_order, is_active, is_public
 ├─ price_monthly_brl, price_yearly_brl
 ├─ features      jsonb  — defaults p/ clinics.settings.features
 └─ limits        jsonb  — caps numéricos (ver §5)
```

UI: lista de planos + dialog de edição com:
- Aba **Geral** (código, nome, preços, ordem, ativo)
- Aba **Recursos** (toggles do mesmo catálogo de `src/lib/features.ts`)
- Aba **Limites** (campos numéricos — ver §5)
- Botão **"Aplicar a clínicas neste plano"** → propaga `features`/`limits` para `clinics.settings`

## 5. Uso & Limites (novo)

Define caps por plano e mostra consumo por clínica. Limites propostos (todos opcionais, `null` = ilimitado):

| Chave | Unidade |
|---|---|
| `max_users` | usuários da clínica |
| `max_leads` | leads totais |
| `max_whatsapp_instances` | conexões |
| `max_messages_month` | mensagens enviadas/mês |
| `max_broadcasts_month` | broadcasts/mês |
| `max_emails_month` | emails enviados/mês |
| `max_email_domains` | domínios |
| `ai_monthly_usd_cap` | espelha `ai_spend_limits.monthly_cap_usd` |
| `max_ai_agents` | agentes |
| `max_kb_documents` | docs em `ai_documents` |
| `storage_mb` | storage agregado |

A aba mostra tabela: clínica × limite × uso atual × % × badge (ok/alerta/excedido). Override por clínica em `clinics.settings.limits` (sobrepõe o plano).

**Enforcement:** nesta entrega só persiste e exibe. Wiring nos pontos de criação (edge functions / RPCs) entra como passo separado (não nesta tarefa) para não inflar o escopo — fica documentado em `docs/architecture/PLANS_LIMITS.md`.

## 6. Auditoria (novo)

Visualizador da tabela `audit_log` já existente:

- Filtros: clínica, ator, ação, data
- Paginação server-side
- Export CSV

## Banco de dados

Migração única:

```sql
-- 1. plans
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  price_monthly_brl numeric(10,2) default 0,
  price_yearly_brl  numeric(10,2) default 0,
  features jsonb not null default '{}'::jsonb,
  limits   jsonb not null default '{}'::jsonb,
  sort_order int default 0,
  is_active boolean default true,
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
grant select on public.plans to authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;
create policy "plans readable by authenticated" on public.plans for select to authenticated using (true);
create policy "plans writable by super admin" on public.plans for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- 2. seed básico (free, starter, pro, enterprise)
insert into public.plans (code, name, sort_order) values
 ('free','Free',1),('starter','Starter',2),('pro','Pro',3),('enterprise','Enterprise',4)
on conflict (code) do nothing;

-- 3. RPCs de métricas (security definer + is_super_admin gate)
create or replace function public.admin_overview_metrics() returns jsonb ...
create or replace function public.admin_clinic_usage(_clinic uuid, _from date, _to date) returns jsonb ...
create or replace function public.admin_top_clinics(_metric text, _limit int) returns setof record ...
```

(Os triggers que já bloqueiam mudanças em `clinics.settings.features` por não-super-admin continuam valendo.)

## Edge functions novas

- `admin-users-list` — paginação + filtros sobre `auth.users` + joins
- `admin-user-action` — reset senha, desbloquear, revogar tokens, promover/revogar super admin
- `admin-apply-plan` — copia `features`/`limits` do plano para clínicas selecionadas

Todas verificam `is_super_admin()` em código (não confiar só em `verify_jwt`).

## Frontend

```text
src/pages/Admin.tsx                          (refator: vira shell de 6 abas)
src/components/admin/
 ├─ DashboardPanel.tsx          (novo)
 ├─ ClinicsTable.tsx            (extrai da Admin atual + enriquece)
 ├─ ClinicDetailsDrawer.tsx     (novo)
 ├─ UsersPanel.tsx              (novo)
 ├─ PlansPanel.tsx              (novo) + PlanEditorDialog
 ├─ UsageLimitsPanel.tsx        (novo)
 ├─ AuditLogPanel.tsx           (novo — reusa AuditLogPanel já em agents? não, escopo global)
 ├─ IntegrationsKeysCard.tsx    (mantém)
 ├─ IntegrationsDomainsTable.tsx(mantém)
 ├─ IntegrationsQuotaTable.tsx  (mantém)
 └─ BuilderManualPanel.tsx      (mantém)
src/hooks/useAdminMetrics.ts                 (novo, React Query)
src/lib/admin-plans.ts                       (helpers de merge plan→clinic)
```

Design: mantém o look atual (Card/Table/Tabs/shadcn). Dashboard usa o mesmo padrão de Cards com KPIs do app, sem novos tokens de cor.

## Docs

- Novo: `docs/architecture/PLANS_LIMITS.md` (modelo, enforcement futuro)
- Atualiza: `docs/architecture/FEATURE_FLAGS.md` (relação com `plans.features`)
- Atualiza: `docs/frontend/PAGES.md` (novas abas)

## Fora de escopo nesta entrega

- Cobrança real / Stripe — só persiste preços
- Enforcement em runtime dos limites (criação de leads, envio de mensagens, etc.) — entra em fase 2
- I18n/inglês — admin segue em PT-BR
- Edição em massa de features por múltiplas clínicas selecionadas (continua 1 a 1)

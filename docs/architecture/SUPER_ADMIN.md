# SUPER_ADMIN — Papel, RLS, Rotas e Edges

> Última atualização: 2026-06-03
> Documento-índice. Para detalhe específico, ver links cruzados.

Consolidação de tudo que o papel `super_admin` representa no sistema: como é armazenado, como é verificado em código (frontend e edge functions), quais rotas e endpoints estão restritos a ele, e quais policies de RLS o tratam como bypass.

---

## 1. Definição

`super_admin` é um valor do enum `app_role` (`'super_admin' | 'admin' | 'moderator' | 'user'`), armazenado **exclusivamente** na tabela `public.user_roles` (`user_id`, `role`).

Regras invioláveis:

- **Nunca** persistir o papel em `profiles`, `clinic_members` ou em qualquer coluna booleana. Apenas em `user_roles`. Ver `conventions/SECURITY.md` e o bloco "User roles" do prompt do sistema.
- **Nunca** dar `INSERT`/`UPDATE`/`DELETE` em `user_roles` para `authenticated` ou `anon` — só `service_role` e o próprio super_admin via policy. Caso contrário, privilege escalation.
- Promoção/revogação só por outro super_admin (edge `admin-user-action` ação `set_super_admin`) ou por SQL operacional direto.
- Bootstrap inicial: `contato@mkart.com.br` foi promovido na migration de seed do papel; novos super_admins são promovidos via `/admin → Usuários`.

---

## 2. Função canônica `is_super_admin`

Definida em migration e descrita em `database/FUNCTIONS_TRIGGERS.md`:

```sql
create or replace function public.is_super_admin(_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = 'super_admin'
  )
$$;
```

`SECURITY DEFINER` é obrigatório para evitar recursão de RLS ao ler `user_roles` de dentro de policies.

---

## 3. Verificação no frontend

Hook `useAuth` (`src/hooks/useAuth.tsx`) expõe `isSuperAdmin: boolean`. Lê `user_roles` ao montar a sessão e revalida a cada `onAuthStateChange`.

```tsx
const { isSuperAdmin } = useAuth();
if (!isSuperAdmin) return <Navigate to="/" replace />;
```

Aplicação prática:

- `src/pages/Admin.tsx` — guarda a rota `/admin` inteira (`if (!isSuperAdmin) return <Navigate />`).
- `useAuth.hasFeature(key)` — super_admin ignora feature flags da clínica (retorna `true` para qualquer chave).
- Componentes do painel (`DashboardPanel`, `UsersPanel`, `PlansPanel`, `UsageLimitsPanel`, `AiSpendLimitCard`, `FinancePanel`, `ObservabilityPanel`, `SupportPanel`/`SupportLiveMonitor`/`SupportTelemetry`/`SupportPinsCard`, `AuditPanel`, `IntegrationsKeysCard`, `IntegrationsDomainsTable`, `IntegrationsQuotaTable`, `BuilderManualPanel`, `ClinicDetailsDialog`) renderizam apenas dentro de `/admin`.

---

## 4. Rotas protegidas

| Rota | Guard | Observação |
|---|---|---|
| `/admin` | `Admin.tsx` → `isSuperAdmin` | Painel global. |
| `/admin → Dashboard` | `DashboardPanel` | KPIs cross-tenant (RPCs `admin_overview_metrics`, `admin_top_clinics`, `admin_daily_metrics`). |
| `/admin → Clínicas` | `ClinicDetailsDialog` + edges `admin-apply-plan`/`admin-revoke-plan` | Aba "Plano & Assinatura" com aplicação/revogação manual. |
| `/admin → Planos` | `PlansPanel` | CRUD do catálogo `plans`. |
| `/admin → Uso & Limites` | `UsageLimitsPanel` | Snapshot por clínica × limite. |
| `/admin → Financeiro` | `FinancePanel` + edge `admin-invoice` | KPIs, gráfico, inadimplentes, distribuição de planos, CRUD de faturas. |
| `/admin → Observabilidade` | `ObservabilityPanel` | RPCs `admin_feature_usage`, `admin_dead_features`, `admin_error_summary`. |
| `/admin → Suporte` | `SupportPanel` (+ Monitor/Telemetria/Pins) + edges `support-*` | Chat Alfred ao vivo, takeover humano, pins, status da KB. |
| `/admin → Usuários` | `UsersPanel` + edges `admin-users-list`/`admin-user-action` | Listar, resetar senha, sign-out, set super_admin, set clinic role, delete user. |
| `/admin → Integrações` | `integrations-status`, `IntegrationsKeysCard` | Presença de secrets — nunca valores. |
| `/admin → Auditoria` | `AuditPanel` | Lê `audit_log`/`data_access_log`/`plan_change_log`. |

Demais rotas autenticadas são abertas a membros da clínica e **não** dependem de super_admin (super_admin tem acesso adicional via RLS bypass).

---

## 5. Edge functions que exigem super_admin

Todas seguem o mesmo padrão: validam Bearer token → resolvem `user_id` → consultam `user_roles` (ou `rpc('is_super_admin')`) → 401/403 se não for super_admin.

| Edge function | Como verifica | Para que serve |
|---|---|---|
| `admin-users-list` | `from('user_roles').eq('role','super_admin')` | Lista paginada de todos os usuários, com clínica/lockout. |
| `admin-user-action` | idem | `set_password`, `unlock`, `sign_out`, `set_super_admin`, `set_clinic_role`, `delete_user`. |
| `admin-apply-plan` | idem | Cria/atualiza `clinic_subscriptions` manual e espelha features/limits em `clinics.settings`. |
| `admin-revoke-plan` | idem | Encerra subscription corrente → fallback Starter `past_due`. |
| `admin-invoice` | idem | `create` / `mark_paid` / `void` / `delete` de `invoices`. |
| `cron-expire-manual-grants` | service_role (cron diário) | Migra `manual_grant`/`trialing` vencidos para Starter. |
| `support-admin-reply` | `rpc('is_super_admin')` | Takeover / release de thread Alfred + resposta humana. |
| `support-kb-sync` | `rpc('is_super_admin')` | Re-indexa KB do Alfred a partir dos `.md` empacotados. |
| `support-kb-status` | `rpc('is_super_admin')` | Diff sha256 (in_sync/stale/missing/deleted). |
| `support-test-connection` | `rpc('is_super_admin')` | Ping no provedor de IA do Alfred. |
| `integrations-status` | `rpc('is_super_admin')` | Retorna presença (boolean) de secrets de integração. |
| `backfill-resend-events` | `rpc('is_super_admin')` | Reprocesso histórico de eventos Resend. |
| `email-domain-manage` | `rpc('is_super_admin')` | Operações destrutivas/cross-tenant em domínios. |

Edges com **super_admin OU clinic admin/owner** (autorização mista):

| Edge function | Padrão | Observação |
|---|---|---|
| `clinic-invite` | super_admin ou `owner/admin` da clínica | Cria convite e devolve URL de aceite. |
| `clinic-create-user` | super_admin ou `owner/admin` da clínica | Cria usuário diretamente vinculado à clínica. |
| `evolution-provision` | super_admin ou admin da clínica alvo | Provisiona instância WhatsApp na Evolution API. |
| `evolution-delete-instance` | super_admin ou admin da clínica alvo | Remove instância. |
| `forms-admin` | super_admin ou admin da clínica | Configuração de formulários. |
| `dispatch-campaign` | super_admin bypassa quota | Disparo manual ignora `ai_spend_limits` global. |
| `send-email` | super_admin bypassa quota | Envio transacional sem checagem de cota da clínica. |
| `support-chat` | qualquer autenticado | Chat Alfred; retorna `423` se `support_chat_threads.taken_over_at` está setado. |
| `track-event` | qualquer autenticado | Insere batch em `feature_events` (server resolve `clinic_id`). |
| `log-frontend-error` | aceita anônimo | ErrorBoundary global → `error_events`. |
| `tracking-event`, `tracking-identify` | super_admin pode emitir cross-clinic | Usado em ferramentas internas de debug. |

---

## 6. Policies de RLS com `is_super_admin()`

Padrão "tenant scoping com bypass":

```sql
USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());
```

Aplicado em praticamente todas as tabelas com `clinic_id` — ver lista completa em `database/RLS_POLICIES.md` § "Padrão tenant scoping".

Padrão "super_admin only" (sem fallback de tenant):

| Tabela | Operação restrita a super_admin |
|---|---|
| `app_settings` | ALL |
| `user_roles` | INSERT/UPDATE/DELETE (SELECT: self + super_admin) |
| `plans` | INSERT/UPDATE/DELETE (SELECT: `authenticated`) |
| `email_domains` | INSERT/UPDATE/DELETE em escopo global |
| `data_access_log` | SELECT/INSERT |
| `audit_log` | SELECT em recortes globais |
| `clinics` | INSERT/DELETE; UPDATE de `settings.features` (bloqueado por trigger `clinics_guard_features` para não-super) |

Ver definição-fonte: `database/RLS_POLICIES.md` §§ "Padrão super_admin only" e "Tabelas com policies especiais".

---

## 7. Índice de arquivos da documentação

Documentos que referenciam o papel (verificados em 2026-06-03):

- `architecture/AUTH.md` — armazenamento em `user_roles`, fluxo de promoção, prevenção de privilege escalation.
- `architecture/MULTI_TENANCY.md` — papel no isolamento, bypass cross-clinic.
- `architecture/PLANS_LIMITS.md` — quem edita catálogo `plans` e aplica via `admin-apply-plan`.
- `architecture/FEATURE_FLAGS.md` — super_admin ignora flags da clínica.
- `database/RLS_POLICIES.md` — todas as policies que dependem de `is_super_admin()`.
- `database/FUNCTIONS_TRIGGERS.md` — definição da função `is_super_admin` e do trigger `clinics_guard_features`.
- `database/SCHEMA.md` — enum `app_role`, tabela `user_roles`.
- `database/MIGRATIONS.md` — migrations de criação/endurecimento do papel.
- `conventions/SECURITY.md` — regra inviolável: roles fora de `profiles`.
- `conventions/SUPABASE_RULES.md` — padrão SECURITY DEFINER + RLS.
- `edge-functions/INDEX.md` — inventário (marca quais exigem super_admin).
- `edge-functions/AI.md`, `EMAIL.md`, `TRACKING.md` — detalhes por função.
- `frontend/ROUTING.md` / `PAGES.md` / `COMPONENTS.md` — guard da rota `/admin` e painéis.
- `flows/TRACKING_TO_LEAD.md` / `flows/EMAIL_CAMPAIGN.md` — onde o bypass aparece nos fluxos.
- `features/FORMS.md` — admin de formulários.
- `integrations/RESEND.md` — quem opera `email-domain-manage` e `backfill-resend-events`.
- `OVERVIEW.md` / `GLOSSARY.md` — termo definido.
- `CHANGELOG.md` — histórico de mudanças relacionadas.

---

## 8. Pitfalls

- Chamar `is_super_admin()` sem `SECURITY DEFINER` causa recursão de RLS ao ler `user_roles`.
- Verificar super_admin no frontend **não** substitui guarda na edge function — sempre revalidar server-side com `service_role`.
- Edge function que use `ANON key` não bypassa RLS — para operações cross-tenant precisa de `service_role`.
- Promover super_admin é definitivo até a revogação; não há expiração automática. Auditar `user_roles` periodicamente.
- Super_admin contorna feature flags no frontend (`useAuth.hasFeature`) — usar conta de teste de cliente comum ao validar UX de flags.

---

## 9. Como auditar

```sql
-- Lista de super_admins ativos:
select u.email, ur.created_at
from public.user_roles ur
join auth.users u on u.id = ur.user_id
where ur.role = 'super_admin'
order by ur.created_at;

-- Policies que dependem do bypass:
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and (qual ilike '%is_super_admin%' or with_check ilike '%is_super_admin%')
order by tablename, policyname;
```

---
title: "Mapa: Auth + Multi-Tenancy"
topic: email
kind: map
audience: agent
updated: 2026-06-07
summary: Autenticação (email/senha + Google), isolamento por `clinic_id` (multi-tenant), papéis (`super_admin`/`admin`/`member`), convites, onboarding, reset de senha. Toda tabela de domínio é escopada por clínica via RLS.
---
# Mapa: Auth + Multi-Tenancy

> **Para localizar edições.** Para entender *por quê*, leia [`docs/architecture/AUTH.md`](../architecture/AUTH.md) e [`docs/architecture/MULTI_TENANCY.md`](../architecture/MULTI_TENANCY.md).
> **Última atualização:** 2026-06-03

---

## 1. O que é

Autenticação (email/senha + Google), isolamento por `clinic_id` (multi-tenant), papéis (`super_admin`/`admin`/`member`), convites, onboarding, reset de senha. Toda tabela de domínio é escopada por clínica via RLS.

## 2. Rotas / pontos de entrada

| Rota | Componente | Pública? |
|---|---|---|
| `/auth` | `src/pages/Auth.tsx` | sim — login/signup |
| `/reset-password` | `src/pages/ResetPassword.tsx` | sim — recovery flow |
| `/invite?token=…` | `src/pages/Invite.tsx` | sim |
| `/onboarding` | `src/pages/Onboarding.tsx` | logado, sem clínica |
| `/team` | `src/pages/Team.tsx` | logado |
| `/` (gate) | `src/components/RootGate.tsx` | redireciona conforme estado |

## 3. Frontend

### Hooks / componentes
- `src/hooks/useAuth.tsx` — context principal: `user`, `session`, `clinicId`, `isSuperAdmin`, `signIn/signUp/signOut/resetPassword`. Registra `onAuthStateChange` cedo + `getUser()` para validar.
- `src/components/ProtectedRoute.tsx` — gate de rotas autenticadas.
- `src/components/FeatureRoute.tsx` — gate por feature flag + role.
- `src/components/RootGate.tsx` — decide destino inicial (`/auth`, `/onboarding`, `/inbox`).
- `src/components/AppShell.tsx` — shell com sidebar (precisa de user).

### Libs
- `src/lib/features.ts` — feature flags por plano/clínica.
- `src/lib/supabase-env.ts` — leitura de env Vite.

### Integrações
- `src/integrations/supabase/client.ts` — **NUNCA EDITAR** (auto-gerado).
- `src/integrations/supabase/types.ts` — **NUNCA EDITAR**.

## 4. Edge functions

| Function | Função |
|---|---|
| `clinic-invite/index.ts` | gera convite + envia email |
| `clinic-create-user/index.ts` | cria user direto (admin) |
| `auth-email-hook/index.ts` | hook do Supabase Auth para emails customizados (ver mapa EMAIL) |

Outras edges sensíveis verificam `has_role()` (ver [ADMIN_SUPER_ADMIN](./ADMIN_SUPER_ADMIN.md)).

## 5. Banco de dados

### Tabelas
| Tabela | Função |
|---|---|
| `auth.users` | gerenciada pelo Supabase — **não criar FK para ela** em código (usar `profiles`). |
| `profiles` | dados user-facing (nome, avatar, etc.) com FK para `auth.users(id)` ON DELETE CASCADE |
| `user_roles` | `user_id`, `role` (enum `app_role`: super_admin/admin/member) |
| `clinics` | tenants. `id`, `name`, `settings` jsonb |
| `clinic_members` | `clinic_id`, `user_id`, papel local na clínica |
| `clinic_invites` | tokens de convite |

### RLS / funções
- `has_role(_user_id, _role)` — SECURITY DEFINER, source of truth de gate.
- `current_user_clinic()` — SECURITY DEFINER, retorna `clinic_id` do user logado.
- `is_super_admin()` — atalho.

### Trigger
- `on_auth_user_created` — cria row em `profiles` automaticamente no signup.

## 6. Integrações externas

- **Google OAuth** via Supabase Auth (configurado em `supabase--configure_social_auth`).
- **Email** de auth via `auth-email-hook` + Lovable Email infra (ver mapa EMAIL).

## 7. Invariantes — "não toque sem ler"

1. **Roles em `user_roles`** — NUNCA em `profiles` ou coluna direta. Privilege escalation risk.
2. **`has_role()` é SECURITY DEFINER** — usar em RLS para evitar recursão.
3. **Toda tabela de domínio tem `clinic_id`** + policy `clinic_id = current_user_clinic()` (com bypass super_admin opcional).
4. **`getUser()` para checks que confiam no user.** `getSession()` só para attachment de token (servidor revalida).
5. **`onAuthStateChange` registrado cedo** (em `useAuth.tsx`) — sem isso, race conditions em refresh.
6. **`emailRedirectTo: window.location.origin`** em `signUp()`. Sem isso, magic link aponta para localhost em prod.
7. **`redirectTo: window.location.origin + '/reset-password'`** em `resetPasswordForEmail()`. Página `/reset-password` é OBRIGATÓRIA (sem ela usuário logaria sem trocar senha).
8. **`/reset-password` é pública** (sem `ProtectedRoute`).
9. **Não criar FK para `auth.users`** em tabelas de domínio — sempre via `profiles.id`.
10. **Convite expira** — `clinic_invites.expires_at` checado na aceitação.
11. **Auto-confirm email desligado** por padrão. Só ligar se usuário pedir.
12. **Sign-up anônimo desligado.** Não ativar sem solicitação explícita.

## 8. Pegadinhas

- Logout não limpa cache de `useCrm` automaticamente — `useAuth` invalida queries no `signOut`.
- `clinicId=null` após login = user sem clínica → forçar `/onboarding`.
- Google OAuth: provider precisa estar configurado no Supabase, senão primeiro login dá "Unsupported provider".
- Convite com email já existente: aceitar adiciona o user à clínica em vez de criar conta nova.
- Reset password: hash `#type=recovery` precisa ser lido pelo `/reset-password` — não usar HashRouter (já é BrowserRouter).
- Refresh token rotation: se múltiplas abas, uma pode invalidar a outra. `onAuthStateChange` lida.

## 9. Receitas

### Adicionar provedor OAuth novo (ex: Apple)
1. Supabase: configurar provider via `supabase--configure_social_auth`.
2. UI: botão em `Auth.tsx` chamando `supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo } })`.
3. Testar callback com `emailRedirectTo: window.location.origin`.

### Adicionar role novo
1. Migration: `ALTER TYPE app_role ADD VALUE 'novo_role'`.
2. Atualizar `has_role` se necessário (já é genérico).
3. UI: lugares que listam roles (UsersPanel).
4. Policies que querem permitir esse role.

### Criar tabela de domínio nova com RLS correta
```sql
CREATE TABLE public.<x> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- demais colunas
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<x> TO authenticated;
GRANT ALL ON public.<x> TO service_role;
ALTER TABLE public.<x> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant" ON public.<x>
  FOR ALL USING (clinic_id = current_user_clinic())
  WITH CHECK (clinic_id = current_user_clinic());
-- opcional super_admin bypass:
CREATE POLICY "super_admin_bypass" ON public.<x>
  FOR SELECT USING (has_role(auth.uid(), 'super_admin'));
```

### Debug "user logou mas não vê nada"
1. `useAuth.clinicId` está setado? Se null → `/onboarding`.
2. `user_roles` tem row? `clinic_members` tem row?
3. RLS da tabela permite `clinic_id = current_user_clinic()`?
4. `current_user_clinic()` retorna correto? (testar via SQL com `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '<user_id>'`).
5. GRANT está presente para `authenticated`?

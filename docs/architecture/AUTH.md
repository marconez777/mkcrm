# Autenticação

> **Quando ler:** ao mexer em login, reset de senha, convites, papéis ou bloqueio de conta.
> **Última atualização:** 2026-06-03
>
> **Endurecimentos 2026-05-27 a 2026-05-28** (ver `database/RLS_POLICIES.md` §"Endurecimentos recentes"): SELECT de colunas com segredos foi revogado de `authenticated`/`anon` em `whatsapp_instances` (`evolution_api_key`, `webhook_token`), `ai_agents` (`api_key`, `embedding_api_key`, `reranker_api_key`) e tokens de `form_integrations`. `clinic_email_integrations` agora só é legível por admins da clínica. Edge functions usam `service_role` para acessar essas colunas.

---

## Fluxo de login (email/senha)

> **Estado atual:** o login é **direto contra o Supabase** (`supabase.auth.signInWithPassword`). **Não existe** edge function `auth-login` no projeto. A tabela `auth_lockouts` **foi dropada em 2026-05-26** (migration `20260526202203_*`) — qualquer código que ainda a referencia retorna vazio/no-op.

```text
UI (src/pages/Auth.tsx)
   │ submit(email, password)
   ▼
supabase.auth.signInWithPassword({ email, password })
   │ erro? → toast.error(error.message)
   │ ok?   → onAuthStateChange dispara em useAuth → Navigate(to: from)
   ▼
useAuth carrega contexto: profile, clinic_members, user_roles
```

Campos relevantes:
- Email normalizado com `.trim().toLowerCase()` no submit.
- `password` mínimo 6 chars (validação HTML).
- Mensagem de erro vem direto do Supabase (sem mapeamento custom).

Cadastro público está **desabilitado** — usuários são criados via convite (`/team` → `clinic-invite`) ou diretamente por super admin (`clinic-create-user` com service role + `email_confirm: true`).

---

## Tabela `auth_lockouts` (dropada)

A tabela foi criada em `20260519191402_*`, ajustada em `20260525181431_*` e **dropada** em `20260526202203_*` (`DROP TABLE IF EXISTS public.auth_lockouts CASCADE`). O código de `admin-user-action` (action `unlock`) e `admin-users-list` ainda referencia a tabela mas a query retorna vazio — campos `locked`, `locked_until`, `failed_attempts` vêm sempre nulos/zerados. Registrado em `known-issues/DEBT.md`.

Reativar lockout exige recriar a tabela + wrapper (edge function ou trigger) — está em `roadmap/`.

---

## Sessão no frontend (`useAuth`)

`src/hooks/useAuth.tsx` expõe o context:

```ts
{ session, user, loading, membership, isSuperAdmin, hasFeature, refreshMembership }
```

Comportamentos importantes:
- `onAuthStateChange` mantém `session` em sincronia.
- A cada **4 minutos** + ao retomar visibilidade/foco, faz `getSession` e, se expira em <5min, força `refreshSession`. Isso evita "token expired" quando o computador dorme.
- `loadCtx(uid)` busca em paralelo `clinic_members` (com clinic embedded) e `user_roles`.
- `hasFeature(key)` retorna `true` se super admin OU feature habilitada na clínica.

---

## Convites de clínica

Tabela `clinic_invites (id, clinic_id, email, role, token, expires_at, accepted_at)`.

Fluxo:
1. Admin cria convite via UI `/team` → edge `clinic-invite` envia email com link `/invite/:token`.
2. Convidado abre o link → se não logado, é redirecionado para `/auth`.
3. Após cadastro/login, página `Invite.tsx` chama RPC `accept_clinic_invite(_token)`.
4. RPC valida: existe, não expirado, email do user bate, e insere em `clinic_members` + marca `accepted_at`.

**Trigger `handle_new_user()`** também aceita convite pendente automaticamente no momento do signup e promove `contato@mkart.com.br` para `super_admin` em `user_roles`.

---

## Google OAuth

Não configurado neste projeto. Se for habilitar: chamar `supabase--configure_social_auth` com `providers: ["google"]` na mesma etapa que adicionar o botão na UI (`Auth.tsx`).

---

## Auto-confirm de email

**Desligado** por padrão (boa prática Supabase). Para criar usuários sem confirmação manual, usar `clinic-create-user` (edge function), que chama `auth.admin.createUser({ email_confirm: true })` com service role.

---

## Logout

```ts
await supabase.auth.signOut();
```

Limpa sessão local + invalida refresh token no servidor.

Super admin tem ação remota equivalente em `admin-user-action` action `sign_out`, que revoga refresh tokens de qualquer usuário (usado pelo painel `/admin`).

---

## Esqueci minha senha

Fluxo padrão Supabase, **sem** edge function própria:

1. Em `/auth`, usuário clica em "Esqueci minha senha" → modo `forgot` na mesma página (`src/pages/Auth.tsx`).
2. Submit chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${APP_BASE_URL}/reset-password })`.
3. UI mostra sempre msg neutra ("Se o email existir, enviamos um link") para não vazar enumeração de emails.
4. Supabase envia email de recovery (template default ou Lovable Cloud se configurado).
5. Link leva para `/reset-password` (rota pública em `App.tsx`, fora do `ProtectedRoute`).
6. `src/pages/ResetPassword.tsx` escuta `onAuthStateChange` por `PASSWORD_RECOVERY` (ou sessão ativa) → mostra form de nova senha → chama `supabase.auth.updateUser({ password })` → redireciona para `/`.
7. Se a página é acessada sem sessão de recovery, mostra "link inválido ou expirado" + botão de volta para `/auth`.

Como `auth_lockouts` não existe mais, o reset de senha não interage com lockout algum.

---

## Ações de super admin (`admin-user-action`)

Aceita `{ user_id, action, payload? }`. Toda chamada grava em `audit_log`.

| Action | Efeito |
|---|---|
| `set_password` | Gera senha aleatória ou aceita uma fornecida (`auth.admin.updateUserById`). |
| `unlock` | Tenta `DELETE` em `auth_lockouts` (tabela dropada) — **no-op efetivo hoje**. |
| `sign_out` | Revoga refresh tokens (`auth.admin.signOut`). |
| `toggle_super_admin` | Insere/remove linha em `user_roles (role='super_admin')`. |

Detalhes em `architecture/PLANS_LIMITS.md` e `edge-functions/INDEX.md`.

---

## Pegadinhas

| Sintoma | Causa |
|---|---|
| Erro genérico "Falha na autenticação" | Mensagem do Supabase chega via `error.message`. Sem mapeamento custom — credencial inválida e email não confirmado caem na mesma toast. |
| Sessão expira sozinha após dormir o PC | Mitigado pelo refresh on `visibilitychange` em `useAuth`. Se voltar: revisar listener. |
| Super admin não aparece como super admin | Inserir manualmente em `user_roles (user_id, role='super_admin')`. Auto-promote só para `contato@mkart.com.br`. |
| RPC `accept_clinic_invite` falha com `invite_email_mismatch` | Email do user logado ≠ email do convite. Pedir para deslogar e usar email correto. |
| "Conta travada" mas usuário não percebe | `auth_lockouts` não é consultada hoje — login simplesmente passa. Se aparecer no painel admin, é resíduo de tentativa antiga e pode ser apagado via action `unlock`. |

---

## Melhorias sugeridas (não implementadas)

- Reativar lockout: edge function `auth-login` que envolve `signInWithPassword` + leitura/escrita em `auth_lockouts`.
- 2FA / TOTP.
- Captcha após 3 tentativas.
- Desbloqueio self-service via email após lockout.
- Mapeamento de erros Supabase → mensagens user-friendly em PT-BR.

# Autenticação

> **Quando ler:** ao mexer em login/cadastro, convites, papéis, lockout ou Google OAuth.
> **Última atualização:** 2026-05-25

---

## Fluxo de login (email/senha)

**Não usamos** `supabase.auth.signInWithPassword` direto no frontend. Toda autenticação passa pela edge function **`auth-login`** (`supabase/functions/auth-login/index.ts`), que adiciona rate limit + lockout.

```text
UI (Auth.tsx)
   │ POST /functions/v1/auth-login { email, password }
   ▼
auth-login (Deno)
   │ 1. Lê auth_lockouts para o email
   │ 2. Se locked_until > now → 423 com mensagem
   │ 3. Tenta signInWithPassword via anon client
   │ 4a. Falhou → incrementa failed_attempts; se ≥5 trava 12h → 401
   │ 4b. Sucesso → DELETE auth_lockouts; retorna { access_token, refresh_token }
   ▼
UI chama supabase.auth.setSession(...) e navega
```

**Códigos HTTP:**
- `200` — sucesso (`{ access_token, refresh_token }`)
- `400` — payload inválido
- `401` — credenciais inválidas (com `remaining` restantes)
- `423` — conta travada (`locked_until` ISO)
- `405` — method not allowed

**Constantes:**
- `MAX_ATTEMPTS = 5`
- `LOCK_HOURS = 12`

---

## Tabela `auth_lockouts`

```sql
auth_lockouts (
  email text PRIMARY KEY,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_attempt_at timestamptz,
  last_ip text
)
```

**Desbloqueio manual:** `DELETE FROM auth_lockouts WHERE email = '...'` (via migração).

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

**Trigger `handle_new_user()`** também aceita convite pendente automaticamente no momento do signup.

---

## Google OAuth

Não configurado por padrão neste projeto (usuários são internos). Se for adicionar: usar `supabase--configure_social_auth` com `providers: ["google"]` na mesma migration que ativa o botão na UI.

---

## Auto-confirm de email

**Desligado** por padrão (boa prática Supabase). Para criar usuários sem confirmação manual, usar `clinic-create-user` (edge function) que usa `auth.admin.createUser({ email_confirm: true })` com service role.

---

## Logout

```ts
await supabase.auth.signOut();
```

Limpa sessão local + invalida refresh token no servidor.

---

## Pegadinhas

| Sintoma | Causa |
|---|---|
| Usuário não consegue logar mesmo com senha certa | Pode estar em lockout. Checar `auth_lockouts`. |
| Erro genérico "Falha na autenticação" sem detalhe | Edge devolveu erro mas frontend não parseou — ver `Auth.tsx` linhas 33-49, lê `error.context` em vários formatos. |
| Sessão expira sozinha após dormir o PC | Mitigado pelo refresh on `visibilitychange` em `useAuth`. Se voltar: revisar listener. |
| Super admin não aparece como super admin | Inserir manualmente em `user_roles (user_id, role)` com `role='super_admin'`. Auto-promote só para `contato@mkart.com.br`. |
| RPC `accept_clinic_invite` falha com `invite_email_mismatch` | Email do user logado ≠ email do convite. Pedir para deslogar e usar email correto. |

---

## Melhorias sugeridas (não implementadas)

- 2FA / TOTP
- "Esqueci minha senha" próprio (hoje depende de reset Supabase padrão)
- Desbloqueio self-service via email após lockout
- Captcha após 3 tentativas

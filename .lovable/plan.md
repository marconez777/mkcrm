# Lockout progressivo no login

Recriar do zero o bloqueio por tentativas erradas, agora **só conta erros reais** (sem os bugs que travavam usuário sem motivo) e com **escala progressiva** que zera ao acertar a senha.

## Regra de bloqueio

Contador por **email** (normalizado em lowercase). Cada senha errada incrementa; cada login bem-sucedido **zera tudo**.

| Faixa de erros | Ação |
|---|---|
| 1–4 erros | nada, só conta |
| 5º erro | bloqueia por **10 min** |
| 10º erro (mais 5) | bloqueia por **1 hora** |
| 13º erro (mais 3) | bloqueia por **12 horas** |
| Após o bloqueio de 12h expirar | zera o contador e volta para a faixa 1 |

Bloqueio ativo: qualquer tentativa (mesmo com senha certa) é rejeitada com mensagem "Conta temporariamente bloqueada. Tente novamente em X min." — **a senha correta só desbloqueia depois que o tempo do bloqueio atual passar**, aí o login zera o contador.

Mensagens de erro continuam neutras (sem dizer "email não existe").

## Arquitetura

```text
UI Auth.tsx
   │ submit
   ▼
edge function `auth-login` (verify_jwt=false, service_role)
   │ 1. lê auth_lockouts pelo email
   │ 2. se locked_until > now() → retorna 423 + tempo restante
   │ 3. chama supabase.auth.signInWithPassword (server-side, só pra validar)
   │ 4a. erro → incrementa failed_attempts, calcula novo locked_until
   │ 4b. ok  → zera linha, devolve { session } pro cliente
   ▼
UI faz supabase.auth.setSession(session) e segue o fluxo normal
```

A senha trafega só do cliente → edge function (HTTPS) → Supabase Auth, igual hoje. Nenhum hash é guardado na nossa tabela.

## Banco

Migration nova:

- Recriar `public.auth_lockouts`:
  - `email text primary key` (lowercase)
  - `failed_attempts int not null default 0`
  - `locked_until timestamptz null`
  - `last_failed_at timestamptz null`
  - `created_at`, `updated_at`
- RLS ON, **sem policies para authenticated/anon** (tabela é só para service_role). GRANT só para `service_role`.
- Função auxiliar `public.register_failed_login(_email text)` e `public.clear_lockout(_email text)` em SECURITY DEFINER, chamadas pela edge function via RPC (mantém a lógica de faixas no banco, fácil de auditar).
- A action `unlock` em `admin-user-action` volta a funcionar (DELETE na linha pelo email do user).

## Edge function `auth-login`

Nova função em `supabase/functions/auth-login/index.ts`:

- CORS + validação Zod `{ email, password }`.
- Normaliza email.
- RPC `check_lockout(email)` → se bloqueado, responde 423 com `retry_after_seconds`.
- Tenta `signInWithPassword` usando client com **anon key** (não service role, pra respeitar o auth normal).
- Sucesso → RPC `clear_lockout(email)` → retorna `{ session }`.
- Falha de credencial → RPC `register_failed_login(email)` → retorna 401 neutro. Outros erros (rate limit nativo, etc.) repassa.

## Frontend

`src/pages/Auth.tsx`:

- Trocar `supabase.auth.signInWithPassword` por `supabase.functions.invoke('auth-login', { body: { email, password } })`.
- Se a resposta vier com `session`, chamar `supabase.auth.setSession({ access_token, refresh_token })` e navegar.
- Se status 423, mostrar toast "Conta bloqueada por tentativas. Tente novamente em X min" usando `retry_after_seconds`.
- Demais erros: toast neutro "Email ou senha inválidos".

`docs/architecture/AUTH.md` atualizado: tabela voltou, fluxo agora passa pela edge function, tabela de faixas progressivas.

## Fora do escopo

- CAPTCHA, MFA, alerta de novo login, HIBP — ficam para depois (já listados na avaliação anterior).
- Não mexe em reset de senha nem em Google OAuth (ainda não configurado).

# Autenticação

A aplicação usa **Supabase Auth** (gerenciado pelo Lovable Cloud) com email/senha.

## Frontend

### `useAuth` (`src/hooks/useAuth.tsx`)
Provider que:
- Inicializa `supabase.auth.getSession()`.
- Assina `onAuthStateChange` para reagir a login/logout.
- Expõe `user`, `session`, `loading`, `signIn`, `signUp`, `signOut`.

### `ProtectedRoute` (`src/components/ProtectedRoute.tsx`)
Wrapper de rotas. Se não houver sessão, redireciona para `/auth`. Usado em volta de toda a área autenticada (Inbox, Kanban, Agents, etc.).

### `/auth` (`src/pages/Auth.tsx`)
Tela de login/cadastro. Após sucesso, redireciona para `/`.

## Backend

### Política RLS
Todas as tabelas do `public` schema usam:
```sql
CREATE POLICY "authenticated_all" ON public.<tabela>
  TO authenticated
  USING (true) WITH CHECK (true);
```

Usuários **anônimos não acessam nada**. Usuários autenticados acessam tudo (single-tenant interno).

### Edge functions

`verify_jwt` é definido por função em `supabase/config.toml`. Hoje rodam **sem JWT** (chamadas server-to-server ou autenticadas por outro mecanismo): `evolution-webhook` (autentica por `?token=`), `evolution-send`, `evolution-test`, `ai-auto-reply`, `ai-chat`, `ai-embed`, `ai-assist`, `ai-ingest-document`, `ai-ingest-pdf`, `ai-ingest-url`, `automations-tick`. As demais (sync, backfill, health, ingest-urls, eval-run, scheduled-dispatcher, transcribe, fetch-wa-avatar) exigem JWT padrão.

Quando o cliente chama uma function via `supabase.functions.invoke(...)`, o JWT do usuário é injetado automaticamente.

## Configurações no Lovable Cloud

- **Auto-confirm email signups**: deixe **desligado** em produção; em dev pode estar ligado para agilizar testes.
- **Provedores adicionais**: Google OAuth pode ser habilitado pelo painel.
- **URL Configuration**: configure `Site URL` e `Redirect URLs` para o domínio de produção (`https://mkcrm.lovable.app` por padrão).

## Migração para multi-tenant (futuro)

Para suportar múltiplas organizações:

1. Criar tabela `organizations` e `organization_members (user_id, org_id, role)`.
2. Adicionar `org_id` em todas as tabelas de domínio (`leads`, `pipelines`, `messages`, `ai_agents`, ...).
3. Criar tabela `user_roles` separada (nunca em `profiles`) e função `has_role(user_id, role)` com `SECURITY DEFINER`.
4. Substituir as policies `authenticated_all` por policies que filtram via `org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())`.

Hoje o produto roda como single-tenant interno — esse caminho fica documentado para quando for necessário.

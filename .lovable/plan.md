# Separar Super Admin em conta dedicada

## Objetivo
Criar uma conta exclusiva de super admin (`marco_next7@hotmail.com`) que **não tenha vínculo com nenhuma clínica**, evitando que dados de clínicas vazem entre telas de operação (Settings, Inbox, Kanban, etc.) e o painel administrativo.

## Decisão de arquitetura
Manter um único sistema de auth (não dá para ter dois Supabase Auth no mesmo projeto), mas reforçar a regra:
- **Super admin "puro"** = usuário com `user_roles.role = 'super_admin'` **e SEM linha em `clinic_members`**.
- **Operador de clínica** = usuário com linha em `clinic_members` (sem super_admin).
- Os dois papéis ficam **mutuamente exclusivos por convenção** (validado no backend).

Isso resolve o conflito atual (seu user é super_admin **e** membro de clínica, então RLS retorna tudo nas telas operacionais).

## Mudanças

### 1. Banco de dados (migration)
- Função `prevent_super_admin_clinic_membership()` + trigger em `clinic_members` que **bloqueia INSERT** se o `user_id` já for super_admin (e vice-versa em `user_roles`).
- Função utilitária `public.is_pure_super_admin(uid)` para uso futuro.

### 2. Roteamento (frontend)
- `RootGate` / `AppShell`: se `isSuperAdmin && !membership` → redirecionar `/` para `/admin` automaticamente.
- Bloquear acesso de super admin puro às rotas operacionais (`/settings`, `/inbox`, `/kanban`, `/team`, etc.) com redirect para `/admin` + toast explicando "essa conta é só admin da plataforma".
- Inverso: usuário sem super_admin que tente `/admin/*` continua sendo barrado como hoje.

### 3. Criação da conta `marco_next7@hotmail.com`
Duas opções (escolha sua na revisão do plano):
- **(A) Eu crio agora via edge function `admin-user-action`** chamando uma nova ação `create_super_admin` (email + senha temporária definidos por você). Conta nasce já com `user_roles.super_admin` e **sem** `clinic_members`.
- **(B) Você cria pela tela `/admin/users` (botão novo "Criar super admin")** — adiciono o botão no `UsersPanel`.

### 4. Migração da sua conta atual
Sua conta atual (a que está logada agora) **continua como operador da clínica** — eu **removo o papel `super_admin`** dela na mesma migration, pra você logar com `marco_next7@hotmail.com` quando quiser administrar a plataforma e com a conta de sempre para operar a clínica.

> Confirmação necessária: qual é o email da sua conta atual que devo **rebaixar** para apenas membro de clínica? (Para não rebaixar a errada.)

### 5. Documentação
- Atualizar `docs/architecture/SUPER_ADMIN.md` e `docs/maps/ADMIN_SUPER_ADMIN.md` com a nova regra de exclusividade.

## O que NÃO muda
- Auth provider, fluxo de login, tabela `auth.users`, RLS das tabelas operacionais (continuam com a policy `is_super_admin OR current_clinic_id`).
- O super admin **continua vendo tudo** nas telas `/admin/*` — só não entra mais nas telas de clínica.

## Perguntas antes de implementar
1. **Opção A ou B** para criar `marco_next7@hotmail.com`? Se A, qual senha inicial?
2. Qual é o email da **sua conta atual** que devo manter como operador da clínica (e remover `super_admin` dela)?

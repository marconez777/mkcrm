# Multi-tenancy

> **Quando ler:** antes de criar qualquer tabela, edge function ou RLS policy. **Esta é a regra mais importante do projeto.**
> **Última atualização:** 2026-06-03 (auditoria documental Fase 1/8 — conteúdo confirmado linha-a-linha contra `current_clinic_id()`, `is_clinic_admin()`, `is_super_admin()`, `has_clinic_access()`, `clinic_has_feature()` e trigger `assert_clinic_id_not_null`).

---

## Modelo

Cada **clínica** (`clinics`) é um tenant. Usuários (`auth.users`) pertencem a uma clínica via `clinic_members` (1 user → 1 clínica neste modelo atual; o schema suporta mais mas RLS assume a "ativa"). `user_roles` é separado e armazena papéis **globais** como `super_admin`.

```text
auth.users
   │
   ├── profiles (1:1) — display name, email mirror
   │
   ├── user_roles (1:N) — papéis globais (super_admin)
   │
   └── clinic_members (1:N na teoria, 1:1 hoje) ─→ clinics
                       role: owner | admin | professional | viewer
```

**Toda tabela de negócio** (`leads`, `messages`, `tasks`, `ai_*`, `email_*`, `tracking_*`, ...) tem:

```sql
clinic_id uuid NOT NULL DEFAULT public.current_clinic_id()
```

E policy:

```sql
USING (clinic_id = public.current_clinic_id())
WITH CHECK (clinic_id = public.current_clinic_id())
```

---

## Funções SQL canônicas

Já existem — **não recriar, sempre reusar**:

| Função | Retorno | Uso |
|---|---|---|
| `current_clinic_id()` | `uuid` | Clínica ativa do user logado. Default de colunas e base de RLS. |
| `current_clinic_role()` | `clinic_role` | `owner`/`admin`/`professional`/`viewer` na clínica ativa. |
| `has_clinic_access(_id uuid)` | `boolean` | `is_super_admin()` OR membro daquela clínica. |
| `is_clinic_admin(_user uuid?)` | `boolean` | É `owner` ou `admin` na clínica atual. |
| `is_super_admin(_user uuid?)` | `boolean` | Tem `super_admin` em `user_roles`. |
| `clinic_has_feature(_id, _key)` | `boolean` | Feature flag por clínica. Ver [FEATURE_FLAGS](./FEATURE_FLAGS.md). |
| `current_clinic_has_feature(_key)` | `boolean` | Atalho da anterior. |

Todas são `SECURITY DEFINER` com `SET search_path = public`.

---

## Papéis

`clinic_role` enum: `owner`, `admin`, `professional`, `viewer` (este último raro).

- **owner** / **admin** → pode mexer em settings, equipe, automações, agentes.
- **professional** → operação normal (inbox, kanban, tarefas).
- **super_admin** (global, em `user_roles`) → tudo, inclusive `/admin` (feature flags, domínios, chaves).

`contato@mkart.com.br` recebe `super_admin` automaticamente no `handle_new_user()`.

---

## Padrões de RLS

### Tabela de negócio (escopo clínica)

```sql
ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<tabela>_clinic_select" ON public.<tabela>
  FOR SELECT TO authenticated USING (clinic_id = current_clinic_id());

CREATE POLICY "<tabela>_clinic_write" ON public.<tabela>
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());
```

### Tabela administrativa (só admin da clínica)

```sql
CREATE POLICY "<tabela>_admin_all" ON public.<tabela>
  FOR ALL TO authenticated
  USING (is_clinic_admin()) WITH CHECK (is_clinic_admin());
```

### Tabela global (super-admin)

```sql
CREATE POLICY "<tabela>_super" ON public.<tabela>
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
```

### Read-only para o app

Tabelas como `audit_log`, `email_logs`, `data_access_log`, `agent_traces`, `email_send_state` permitem SELECT por escopo e bloqueiam INSERT/UPDATE/DELETE para usuários comuns — escrita só via SECURITY DEFINER ou edge function com service role.

---

## Edge functions e tenancy

Funções **autenticadas** (com JWT) recebem `auth.uid()` no contexto se passarem o header `Authorization: Bearer <token>`. Use o cliente Supabase com esse token e o RLS aplica naturalmente.

Funções **não-autenticadas** (webhooks, tracking, pixel) usam `SUPABASE_SERVICE_ROLE_KEY` para bypassar RLS e **devem filtrar manualmente** por `clinic_id` (resolvido via instância WhatsApp, segmento de tracking, etc.).

---

## Trigger `assert_clinic_id_not_null`

Para tabelas IA (`ai_messages`, `agent_traces`, etc.) onde `current_clinic_id()` pode falhar (ex.: insert via service role), há trigger que deriva `clinic_id` de `agent_id`/`lead_id`/`thread_id`. Se nada funciona, lança `23502 clinic_id_required`.

Aplicar em qualquer tabela IA nova:

```sql
CREATE TRIGGER ensure_clinic_id BEFORE INSERT ON public.<tabela>
  FOR EACH ROW EXECUTE FUNCTION public.assert_clinic_id_not_null();
```

---

## Pegadinhas

| Problema | Causa / Solução |
|---|---|
| INSERT falha com `null clinic_id` em cron / service role | Use service role + setar `clinic_id` explicitamente, ou usar trigger derivador. |
| Usuário consegue mover registro pra outra clínica | Faltou `WITH CHECK` na policy de UPDATE. |
| "infinite recursion detected in policy" | Policy faz SELECT na própria tabela. Use `SECURITY DEFINER` function (ex.: `is_clinic_admin`). |
| Super admin não vê dados | Verificar `has_clinic_access` na policy ou criar policy específica `USING (is_super_admin())`. |
| Cliente Supabase em edge function ignora RLS | Está usando service role (`createClient(url, SERVICE_ROLE)`). Para respeitar RLS, propagar JWT do usuário. |

# Convenções — Supabase / Lovable Cloud

> **Quando ler:** antes de qualquer mudança que toque banco, edge function, auth ou storage.
> **Última atualização:** 2026-05-25

---

## Arquivos PROIBIDOS de editar manualmente

Estes são auto-gerados ou gerenciados pela plataforma. Editar manualmente quebra o projeto:

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env`
- `supabase/config.toml` — **somente** configurações por função são permitidas; nunca alterar `project_id` ou settings globais.

Se você precisa de novos tipos: rode uma migração e a regeneração é automática.

---

## Mudanças de schema

Sempre via `supabase--migration` (ferramenta) — nunca via SQL manual no painel.

**Regras:**
- Toda tabela de negócio tem `clinic_id uuid NOT NULL DEFAULT current_clinic_id()`.
- Toda tabela tem RLS habilitada: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
- Policy padrão: `USING (clinic_id = current_clinic_id())`.
- Tabelas administrativas: usar `is_clinic_admin()` ou `is_super_admin()`.
- **NUNCA** referenciar `auth.users` por foreign key. Use `user_id uuid` solto e join via `profiles`.
- **NUNCA** armazenar role na tabela `profiles` ou `clinics`. Use `user_roles` / `clinic_members`.
- Triggers que precisam de privilégios elevados: `SECURITY DEFINER` + `SET search_path = public`.
- **Nunca** usar CHECK constraints com expressões mutáveis (`now()`, `current_user`). Use trigger de validação.
- **Nunca** mexer em schemas reservados: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.
- Validações temporais (`expire_at > now()`): trigger, não CHECK.

---

## Edge functions

- Deploy é **automático** ao salvar `index.ts`. Não peça ao usuário para fazer deploy.
- Auto-restart também é automático após `code--exec` install. Não chamar `restart_dev_server` para isso.
- Cada função tem CORS headers no topo (padrão do projeto):
  ```ts
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  ```
- Funções públicas (sem JWT): tracking-*, webhooks, pixel. Configurar `verify_jwt = false` em `supabase/config.toml`.
- Secrets: nunca commitar. Verificar com `secrets--fetch_secrets`. Se faltar, pedir ao usuário com `secrets--add_secret`.

---

## Variáveis de ambiente disponíveis no frontend

Apenas estas três:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Tudo mais é segredo (edge functions only).

---

## Cliente Supabase

Importar sempre:
```ts
import { supabase } from "@/integrations/supabase/client";
```
Nunca instanciar `createClient` no frontend.

---

## Realtime

Habilitar tabela:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.<tabela>;
```
Tabelas já em realtime: `messages`, `leads`. Veja `architecture/REALTIME.md`.

---

## Limites a lembrar

- **1000 rows por query** é o default do PostgREST. Se faltar dado, é provavelmente isso. Use paginação.
- Edge function timeout: ~60s. Tarefas longas → cron + tabela de fila.
- `pg_net` para invocar edge functions a partir de triggers — assíncrono, não bloqueia.

---

## Pegadinhas comuns

| Sintoma | Causa provável |
|---|---|
| RLS recursiva ("infinite recursion") | Policy consulta a própria tabela. Solução: `SECURITY DEFINER` function. |
| `insert` em tabela com `clinic_id NOT NULL` falha | Tabela sem default `current_clinic_id()` ou trigger `assert_clinic_id_not_null`. |
| Dados "somem" após paginar | Limite 1000. Acrescente `.range()` ou `.limit()`. |
| Edge function 401 | Falta `verify_jwt = false` em config.toml para função pública. |
| Tipos do Supabase desatualizados | Aguardar regeneração; nunca editar `types.ts`. |

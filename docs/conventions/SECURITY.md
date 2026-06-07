---
title: Convenções — Segurança
topic: auth
kind: reference
audience: agent
updated: 2026-06-07
summary: "1. **RLS-first**: toda tabela tem RLS habilitada, sem exceção. 2. **Roles em tabela separada** (`user_roles`, `clinic_members`). Nunca em `profiles`/`clinics`. 3. **Server-side validation** sempre. Nada de admin check via `localStorage`/`se"
---
# Convenções — Segurança

> **Quando ler:** antes de criar tabelas, edge functions públicas ou fluxos de auth/admin.
> **Última atualização:** 2026-06-03

---

## Princípios

1. **RLS-first**: toda tabela tem RLS habilitada, sem exceção.
2. **Roles em tabela separada** (`user_roles`, `clinic_members`). Nunca em `profiles`/`clinics`.
3. **Server-side validation** sempre. Nada de admin check via `localStorage`/`sessionStorage`.
4. **Secrets só em edge functions**, nunca no frontend. Frontend conhece apenas `VITE_*`.
5. **Sem hardcoded credentials**. Toda chave por `Deno.env.get()` ou via secrets manager.

---

## Padrão de policy

```sql
-- Tabela operacional, escopo por clínica
CREATE POLICY "clinic_select" ON public.<tabela>
  FOR SELECT TO authenticated
  USING (clinic_id = current_clinic_id());

CREATE POLICY "clinic_write" ON public.<tabela>
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());
```

```sql
-- Tabela administrativa
CREATE POLICY "admin_all" ON public.<tabela>
  FOR ALL TO authenticated
  USING (public.is_clinic_admin())
  WITH CHECK (public.is_clinic_admin());
```

```sql
-- Tabela super-admin only
CREATE POLICY "super_admin_all" ON public.<tabela>
  FOR ALL TO authenticated
  USING (public.is_super_admin());
```

---

## SECURITY DEFINER

Use para funções que **precisam contornar RLS** (ex.: `current_clinic_id`, `has_clinic_access`, `accept_clinic_invite`). Sempre com:

```sql
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
```

`search_path` é obrigatório para prevenir hijack via schema malicioso.

---

## Funções core já existentes (não recriar)

| Função | O que faz |
|---|---|
| `current_clinic_id()` | clínica ativa do usuário logado |
| `current_clinic_role()` | role na clínica ativa |
| `has_clinic_access(uuid)` | super admin OU membro |
| `is_clinic_admin(uuid)` | role owner/admin na clínica atual |
| `is_super_admin(uuid)` | tem entrada em `user_roles` com role `super_admin` |
| `clinic_has_feature(uuid, text)` | feature flag por clínica |
| `current_clinic_has_feature(text)` | atalho da anterior |

---

## Edge functions públicas

Quando `verify_jwt = false` em `config.toml`:
- Validar **manualmente** payload, origem, rate limit.
- Para webhooks externos: validar assinatura HMAC ou token compartilhado (`evolution-webhook` autentica via `?token=` na URL).
- CORS: ecoar `Origin` quando há credenciais — ver `known-issues/CORS_FORMS_INGEST.md`.

Funções públicas atuais: `tracking-pixel`, `tracking-event`, `tracking-identify`, `tracking-config`, `evolution-webhook`, `resend-webhook`, `email-unsubscribe`, `forms-ingest`, `forms-snippet`, `forms-plugin-zip`, `wa-redirect`, `external-lead-capture`.

> Auth nativa do Supabase (`supabase.auth.signInWithPassword`) é usada diretamente — não existe edge function `auth-login`. Rate limit / lockout custom (`auth_lockouts`) foi removido em 2026-05-26; hoje depende do rate limit nativo do Auth.

---

## Pegadinhas

- **Trigger lendo a própria tabela** com RLS → loop infinito. Use `SECURITY DEFINER`.
- **`with check` faltando** em UPDATE → usuário pode mover registro pra outra clínica.
- **Default `current_clinic_id()`** falha se a função for chamada em contexto sem `auth.uid()` (cron, webhook). Use trigger `assert_clinic_id_not_null` que deriva via `agent_id`/`lead_id`/`thread_id`.
- **`SECURITY DEFINER` sem `search_path`** = vulnerabilidade. Sempre incluir.

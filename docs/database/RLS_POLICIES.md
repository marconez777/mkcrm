---
title: RLS_POLICIES — Row Level Security
topic: database
kind: reference
audience: agent
updated: 2026-06-07
summary: "1. **100% das tabelas em `public` têm RLS ativado.** Não existe tabela \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"aberta\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\". 2. Acesso é sempre derivado de **uma das três** funções `SECURITY DEFINER`: - `current_clinic_id()` — clínica do usuário autenticado (via `clinic_members`). - "
---
# RLS_POLICIES — Row Level Security

> Última atualização: 2026-06-03
> Fonte de verdade: `pg_policies` no schema `public` + `supabase/migrations/*.sql`.

## Princípios

1. **100% das tabelas em `public` têm RLS ativado.** Não existe tabela "aberta".
2. Acesso é sempre derivado de **uma das três** funções `SECURITY DEFINER`:
   - `current_clinic_id()` — clínica do usuário autenticado (via `clinic_members`).
   - `has_clinic_access(_clinic_id)` — true se super_admin OU membro daquela clínica.
   - `is_super_admin()` — bypass total (apenas para `contato@mkart.com.br` e outros explicitamente promovidos em `user_roles`).
3. **Nunca** consulte a própria tabela dentro da policy (loop infinito) — sempre use SECURITY DEFINER helper.
4. Roles nunca ficam em `profiles` ou colunas booleanas — sempre em `user_roles`.
5. Edge functions com lógica privilegiada usam `service_role` (bypass RLS), nunca chave anon.

## Funções helper (definições em `FUNCTIONS_TRIGGERS.md`)

| Função | Retorna | Usada em |
|---|---|---|
| `current_clinic_id()` | `uuid` | Quase toda policy de SELECT/INSERT/UPDATE/DELETE |
| `current_clinic_role()` | `clinic_role` | Policies que distinguem `owner`/`admin`/`member` |
| `has_clinic_access(uuid)` | `bool` | Cross-clinic checks |
| `is_clinic_admin(uuid)` | `bool` | Operações administrativas |
| `is_super_admin(uuid)` | `bool` | Bypass / settings globais |
| `clinic_has_feature(uuid, text)` | `bool` | Feature flags |
| `current_clinic_has_feature(text)` | `bool` | Shortcut da anterior |

## Padrões de policy

### Padrão "tenant scoping" (usado em ~80% das tabelas)

```sql
CREATE POLICY "tenant_select" ON public.<tabela>
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());

CREATE POLICY "tenant_modify" ON public.<tabela>
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());
```

Aplicado a: `leads`, `messages`, `pipelines`, `pipeline_stages`, `tasks`, `task_*`, `email_templates`, `email_queue`, `email_logs`, `email_campaigns`, `email_automations`, `email_segments`, `email_unsubscribes`, `message_sequences*`, `broadcasts*`, `whatsapp_instances`, `whatsapp_intents`, `ai_agents`, `ai_threads`, `ai_messages`, `ai_documents`, `ai_chunks`, `ai_insights`, `agent_*`, `tracking_*`, `form_*`, `lead_*`, `automation*`, etc.

### Padrão "admin-only modify"

Leitura por qualquer membro da clínica; modificação só por `owner/admin`:

```sql
FOR INSERT/UPDATE/DELETE
USING  (clinic_id = current_clinic_id() AND is_clinic_admin())
WITH CHECK (clinic_id = current_clinic_id() AND is_clinic_admin());
```

Aplicado a: `clinic_invites`, `clinic_members` (delete), `whatsapp_instances` (delete), `email_domains`, `email_send_state`, `clinic_email_integrations`, `ai_spend_limits`, `stage_ai_defaults`, `traffic_source_rules`.

### Padrão "super_admin only"

```sql
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());
```

Aplicado a: `app_settings`, `user_roles`, `email_domains` (write), `audit_log` (read em alguns casos), `data_access_log`, `plans` (write — SELECT é aberto a `authenticated`).

### Padrão "user-scoped" (escopo por `auth.uid()`)

```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

Aplicado a: `profiles` (self-update), `agent_evals` (rater_id), `ai_agent_drafts` (`user_id`).

### Padrão "public read" (raros — somente onde realmente necessário)

- `form_definitions` — SELECT público para renderizar form (mas insert/update só com tenant scope).
- `clinics` — SELECT público de **alguns campos** (logo, name) via view; a tabela em si exige acesso.
- `tracking_visitors`/`tracking_sessions`/`tracking_events` — INSERT público (anon) para receber pixels, **mas SELECT só com tenant scope**.

## Tabelas com policies especiais

### `clinics`
- SELECT: membro da clínica OU super_admin.
- UPDATE: super_admin sempre; admin/owner para colunas operacionais (mas `settings.features` é bloqueado pelo trigger `clinics_guard_features`).
- INSERT/DELETE: super_admin apenas.

### `clinic_members`
- SELECT: o próprio user vê seu vínculo; admin/owner veem todos da clínica.
- INSERT/UPDATE: via `accept_clinic_invite()` (SECURITY DEFINER) ou admin.
- DELETE: admin/owner.
- ⚠ Cuidado: policy não pode referenciar `clinic_members` (recursão) — usa helper `current_clinic_id()`.

### `clinic_invites`
- SELECT por `token` (anon permitido) para a página de aceite — implementado via SECURITY DEFINER em `accept_clinic_invite`.
- INSERT: admin da clínica.

### `plans` *(novo — jun/2026)*
- SELECT: `authenticated` (qualquer usuário logado lê o catálogo).
- INSERT/UPDATE/DELETE: gated por `is_super_admin()`.
- `GRANT SELECT ON public.plans TO authenticated; GRANT ALL ON public.plans TO service_role;`
- Edição via `/admin` → aba **Planos** (`PlansPanel`). Propagação para clínicas via edge `admin-apply-plan`. Ver `architecture/PLANS_LIMITS.md`.

### `messages`
- SELECT/INSERT: tenant scope.
- INSERT também aceito de webhook (service_role bypass) — edge function `whatsapp-webhook`.

### `email_queue` / `email_logs`
- Tenant scope.
- Service_role grava (worker `email-sender`).

### `webhook_events` / `webhook_dedup`
- Tenant scope para leitura.
- Service_role escreve.

### `tracking_*` (events/sessions/visitors)
- INSERT **anônimo permitido** (pixel) com `WITH CHECK (clinic_id IS NOT NULL)`.
- SELECT: tenant scope.
- Esses são os únicos casos onde `anon` insere.

### `form_submissions`
- INSERT anônimo (com validação no edge `forms-submit`).
- SELECT: tenant scope.

### `ai_spend_limits`
- SELECT: tenant scope.
- UPDATE: super_admin (limites globais) + admin (warn thresholds locais).

### `ai_usage` / `ai_spend_events`
- SELECT: tenant scope.
- INSERT: service_role (edge functions de IA).

### `user_roles`
- SELECT: o próprio user vê suas roles; super_admin vê tudo.
- INSERT/UPDATE/DELETE: super_admin only.
- ⚠ **Nunca** dê INSERT público — privilege escalation.

## Endurecimentos recentes (2026-05-27 a 2026-05-30)

Várias colunas/funções tiveram acesso revogado dos roles client-side para reduzir superfície de ataque:

| Alvo | Mudança | Migration |
|---|---|---|
| `clinic_email_integrations` SELECT | Restrito a admins da clínica (`is_clinic_admin()`); leitura genérica removida. | 2026-05-27 `ba34dac1` |
| `whatsapp_instances.evolution_api_key`, `webhook_token` | `REVOKE SELECT` de `authenticated` e `anon`. Edge functions usam `service_role`. | 2026-05-27 `5fd7651b` / 2026-05-28 `4cfd67a9` |
| `form_integrations` tokens | SELECT só para admins da clínica. | 2026-05-28 `4cfd67a9` |
| `ai_agents.api_key`, `embedding_api_key`, `reranker_api_key` | `REVOKE SELECT` de `authenticated` e `anon`. | 2026-05-28 `b8a57b5c` |
| `agent_mcp_servers.headers` | `REVOKE SELECT` de `authenticated` e `anon` (pode conter tokens). | 2026-06-03 |
| `ai_agent_drafts` SELECT | Restrito a `user_id = auth.uid()` (antes: qualquer membro da clínica). | 2026-06-03 |
| `error_events` INSERT | Restrito a `authenticated` com `auth.uid() IS NOT NULL` (antes: `WITH CHECK (true)`). | 2026-06-03 |
| RPCs `engagement_broadcasts_summary`, `engagement_sequences_summary`, `engagement_sequence_steps` | `REVOKE EXECUTE FROM PUBLIC, anon`. Acessíveis só por `authenticated`. | 2026-05-30 `ae1f2058` |

**Padrão geral:** segredos e PII de integração nunca devem retornar via Data API; o cliente pede via edge function com `service_role`, que checa `has_clinic_access` antes de devolver mascarado.

## Como auditar

```sql
-- Tabelas sem RLS (deve retornar 0 linhas):
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;

-- Policies de uma tabela:
SELECT policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public' AND tablename='leads';

-- Linter automático:
-- via mcp/dashboard: rode `supabase--linter`.
```

## Pitfalls

- **Recursão**: policies em `clinic_members` ou `user_roles` que `SELECT` da própria tabela quebram com `infinite recursion detected in policy`. Sempre via SECURITY DEFINER helper.
- **`current_clinic_id()` retorna NULL** se o user não é membro de nenhuma clínica → todas as policies de tenant falham silenciosamente (retornam 0 linhas). Verificar onboarding.
- **`anon` em tracking/forms**: a edge function valida `clinic_id` antes de inserir; **não** confiar só na policy. A policy só impede leitura.
- **Edge functions usando ANON key** não pulam RLS — devem usar service_role quando precisam atravessar tenants.
- **JOIN com tabela RLS-protegida** em uma view: a view executa com permissões do invocador por padrão; cuidado ao criar views com `SECURITY DEFINER` (devem ser raríssimas e auditadas).
- **`WITH CHECK` ausente** num policy `FOR ALL` permite que UPDATE mude `clinic_id` para outro tenant. Sempre incluir `WITH CHECK`.

## Melhorias sugeridas (ver `roadmap/IMPROVEMENTS.md`)

- Padronizar nomenclatura de policies (`<tabela>_<ação>_<escopo>`).
- Adicionar policies de DELETE explícitas (algumas tabelas confiam em `FOR ALL`).
- View materializada de "tabelas sem policy de DELETE" para revisão periódica.
- Habilitar `pg_audit` para tabelas sensíveis (`user_roles`, `clinics.settings`).

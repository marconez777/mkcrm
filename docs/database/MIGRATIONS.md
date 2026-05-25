# MIGRATIONS — Histórico e governança

> Última atualização: 2026-05-25
> Fonte: `supabase/migrations/*.sql` (90 arquivos).
> Cada migration tem timestamp `YYYYMMDDHHMMSS_<uuid>.sql`.

## Visão geral

- **Total**: ~90 migrations.
- **Período coberto**: 2026-05-03 → 2026-05-25.
- **Tool**: criadas via `supabase--migration` (Lovable) — nunca editar manualmente após aplicadas.
- **Princípio**: cada migration é **idempotente quando possível** (uso de `IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO NOTHING`).

## Cronologia por fase

| Data | Foco |
|---|---|
| 2026-05-03 | Bootstrap: `clinics`, `clinic_members`, `clinic_invites`, `profiles`, `user_roles`, helpers tenancy, RLS inicial |
| 2026-05-04 → 05-07 | Pipelines, leads, stages, messages, WhatsApp instances |
| 2026-05-08 → 05-10 | Tasks/Kanban (boards/columns/labels/assignees/checklists) |
| 2026-05-11 → 05-14 | Email marketing: templates, queue, logs, automations, segments, unsubscribes, dedup, send_state |
| 2026-05-15 → 05-17 | Tracking (pixel), forms públicos, broadcasts |
| 2026-05-18 → 05-19 | IA: agents, threads, messages, RAG (`ai_documents`, `ai_chunks`), embeddings, `match_chunks_hybrid` |
| 2026-05-20 | Audit log, data_access_log, refinamentos de RLS, `auth_lockouts` |
| 2026-05-25 | AI spend guard (`ai_spend_limits`, `ai_spend_events`, `ai_spend_notifications_sent`, trigger `ai_usage_spend_guard`), fix de login (auth_lockouts policy) |

## Como criar uma nova migration

**Sempre** via tool `supabase--migration` (que cria o arquivo + aplica). Nunca:
- editar uma migration já aplicada (cria divergência com remoto);
- rodar `ALTER DATABASE postgres ...`;
- mexer em schemas reservados (`auth`, `storage`, `realtime`, `supabase_functions`, `vault`).

Template recomendado:

```sql
-- 1) Schema changes
CREATE TABLE IF NOT EXISTS public.<tabela> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- campos...
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) RLS
ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<tabela>_tenant_select" ON public.<tabela>
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());

CREATE POLICY "<tabela>_tenant_modify" ON public.<tabela>
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

-- 3) updated_at trigger
CREATE TRIGGER <tabela>_set_updated_at
  BEFORE UPDATE ON public.<tabela>
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_<tabela>_clinic ON public.<tabela>(clinic_id);
```

### Checklist obrigatório

- [ ] RLS habilitado em toda tabela nova.
- [ ] `clinic_id` NOT NULL com FK para `clinics(id)`.
- [ ] Pelo menos uma policy de SELECT e uma de modify (com `WITH CHECK`).
- [ ] Trigger `set_updated_at` se houver `updated_at`.
- [ ] Index em `clinic_id` (sempre) e em colunas de filtro frequente.
- [ ] Validar com `supabase--linter` após aplicar.
- [ ] Se a tabela é multi-tenant, adicionar ao realtime publication só se o frontend precisar (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`).
- [ ] Documentar em `docs/database/SCHEMA.md`.

### Quando NÃO usar migration

- Inserir/atualizar dados → use `supabase--insert` (INSERT/UPDATE/DELETE) ou edge functions.
- Configurar auth → use `supabase--configure_auth` ou `configure_social_auth`.
- Deploy edge function → use `supabase--deploy_edge_functions`.

## Boas práticas

1. **Uma feature = uma migration** (idealmente). Não acumule mudanças de domínios distintos.
2. **Migrations descritivas** — o `description` do tool é mostrado ao usuário; escreva em PT-BR não técnico.
3. **Reversibilidade limitada**: Supabase não tem `down migrations` automático. Para rollback, escreva uma nova migration que desfaz.
4. **Evite breaking changes**:
   - Adicionar coluna nullable → ok.
   - Adicionar coluna NOT NULL sem default em tabela com dados → quebra. Faça em 3 etapas: adicionar nullable → backfill → tornar NOT NULL.
   - Renomear coluna → quebra clients. Adicione nova, copie, deprecate.
5. **Recompilar `types.ts`**: depois de cada migration aprovada, `src/integrations/supabase/types.ts` é regenerado automaticamente. **Nunca** edite à mão.

## Pitfalls observados no histórico

- **Várias migrations adicionam policies em tabelas já existentes** — algumas têm nomes duplicados em tabelas distintas. Considere padronizar `<tabela>_<ação>_<escopo>`.
- **Algumas tabelas têm `FOR ALL` policy sem `WITH CHECK` explícito** — risco de UPDATE mudando `clinic_id`. Auditar.
- **Triggers para `email_on_stage_change`** podem não estar criadas em todos os ambientes — verificar via `pg_trigger`.
- **`cron_service_role_key` em `app_settings`** começa como `PLACEHOLDER`. Cron jobs não funcionam até trocar (operação manual via dashboard).
- **Migrations grandes** (>200 linhas) misturando schema + dados são difíceis de revisar; preferir separar.

## Como inspecionar o que foi aplicado

```bash
# Listar migrations (filesystem):
ls supabase/migrations/

# Histórico aplicado no banco:
psql -c "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 20;"
```

(O schema `supabase_migrations` é gerenciado pela CLI/Lovable.)

## Backups e recuperação

- Backups diários automáticos via Supabase (cobertos pelo Lovable Cloud).
- PITR (point-in-time recovery) disponível no plano correspondente.
- Para restaurar tabela específica: exportar via dashboard, recriar via migration.

## Próximos passos recomendados

Listados também em `roadmap/IMPROVEMENTS.md`:

- Script de validação que roda no CI: `supabase--linter` + checagem "100% RLS" + "FK em todo `clinic_id`".
- Padronizar prefixo de policies.
- Migration "consolidação" anual (squash) — opcional, alto risco.

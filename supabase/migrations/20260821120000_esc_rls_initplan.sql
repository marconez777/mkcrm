-- =====================================================================
-- RLS de email_segment_contacts: de "por linha" para "uma vez por query"
--
-- Sintoma (21/08/2026, tenant MCD): Email > Contatos ficava no spinner e o
--   HEAD /rest/v1/email_segment_contacts?select=id&clinic_id=eq.<mcd>
--   (Prefer: count=exact) devolvia 500 — statement_timeout (8s) do role
--   authenticated.
--
-- Causa: a policy `esc_clinic` chamava
--   has_clinic_access(clinic_id) AND clinic_has_feature(clinic_id, 'email_marketing')
-- POR LINHA. As duas funções são SECURITY DEFINER + SET search_path, então o
-- planner não as inlina: cada linha custa 3 subconsultas (is_super_admin,
-- clinic_members, clinics). Numa lista grande (importação por CSV) o count(*)
-- e as páginas com OFFSET alto estouram o timeout.
--
-- Correção: a clínica entra num array calculado UMA vez por query (InitPlan —
-- o `(SELECT …)` sem referência à linha é o que garante isso) e a policy só
-- compara clinic_id = ANY(array). Mesma semântica da policy anterior:
--   c.id ∈ array  ⇔  has_clinic_access(c.id) AND clinic_has_feature(c.id, 'email_marketing')
--
-- O cast `::uuid[]` é obrigatório: `ANY ((SELECT …))` mesmo com parênteses
-- duplos é lido como ANY(subquery) e falha com 42883 (uuid = uuid[]).
-- Com o cast vira ANY(array) e o SELECT continua sendo InitPlan.
--
-- `accessible_clinic_ids(_feature)` é genérica de propósito: as outras tabelas
-- do módulo de e-mail (email_logs, email_queue, …) usam o mesmo padrão por
-- linha e podem migrar para ela quando o volume justificar.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.accessible_clinic_ids(_feature text DEFAULT NULL)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(c.id), '{}'::uuid[])
  FROM public.clinics c
  WHERE public.has_clinic_access(c.id)
    AND (_feature IS NULL OR public.clinic_has_feature(c.id, _feature));
$$;

COMMENT ON FUNCTION public.accessible_clinic_ids(text) IS
  'Clínicas que o usuário atual acessa (has_clinic_access) e, se informado, '
  'que têm a feature ligada (clinic_has_feature). Para usar em policies como '
  'clinic_id = ANY ((SELECT public.accessible_clinic_ids(''feature''))::uuid[]) — '
  'o SELECT vira InitPlan e roda uma vez por query, não por linha. O cast é '
  'obrigatório, senão o Postgres lê como ANY(subquery) e falha.';

REVOKE EXECUTE ON FUNCTION public.accessible_clinic_ids(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accessible_clinic_ids(text) TO authenticated, service_role;

DROP POLICY IF EXISTS esc_clinic ON public.email_segment_contacts;
CREATE POLICY esc_clinic ON public.email_segment_contacts
  FOR ALL TO authenticated
  USING (clinic_id = ANY ((SELECT public.accessible_clinic_ids('email_marketing'))::uuid[]))
  WITH CHECK (clinic_id = ANY ((SELECT public.accessible_clinic_ids('email_marketing'))::uuid[]));

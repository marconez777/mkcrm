
-- Helpers
CREATE OR REPLACE FUNCTION public.clinic_has_feature(_clinic_id uuid, _key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (settings #>> ARRAY['features', _key]) FROM public.clinics WHERE id = _clinic_id) <> 'false',
    true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_has_feature(_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.clinic_has_feature(public.current_clinic_id(), _key);
$$;

-- Bloqueia non-super-admin de alterar settings.features
CREATE OR REPLACE FUNCTION public.guard_clinic_features()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (COALESCE(OLD.settings -> 'features', 'null'::jsonb)
      IS DISTINCT FROM COALESCE(NEW.settings -> 'features', 'null'::jsonb))
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'only super admin can change clinic features';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinics_guard_features ON public.clinics;
CREATE TRIGGER clinics_guard_features
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.guard_clinic_features();

-- Reforça RLS de tabelas feature-gated
DROP POLICY IF EXISTS clinic_scoped ON public.automations;
CREATE POLICY clinic_scoped ON public.automations
  TO authenticated
  USING (clinic_id = current_clinic_id() AND current_clinic_has_feature('automations'))
  WITH CHECK (clinic_id = current_clinic_id() AND current_clinic_has_feature('automations'));

DROP POLICY IF EXISTS clinic_scoped ON public.message_sequences;
CREATE POLICY clinic_scoped ON public.message_sequences
  TO authenticated
  USING (clinic_id = current_clinic_id() AND current_clinic_has_feature('sequences'))
  WITH CHECK (clinic_id = current_clinic_id() AND current_clinic_has_feature('sequences'));

DROP POLICY IF EXISTS clinic_scoped ON public.message_sequence_steps;
CREATE POLICY clinic_scoped ON public.message_sequence_steps
  TO authenticated
  USING (clinic_id = current_clinic_id() AND current_clinic_has_feature('sequences'))
  WITH CHECK (clinic_id = current_clinic_id() AND current_clinic_has_feature('sequences'));

DROP POLICY IF EXISTS clinic_scoped ON public.message_sequence_enrollments;
CREATE POLICY clinic_scoped ON public.message_sequence_enrollments
  TO authenticated
  USING (clinic_id = current_clinic_id() AND current_clinic_has_feature('sequences'))
  WITH CHECK (clinic_id = current_clinic_id() AND current_clinic_has_feature('sequences'));

DROP POLICY IF EXISTS clinic_scoped ON public.message_templates;
CREATE POLICY clinic_scoped ON public.message_templates
  TO authenticated
  USING (clinic_id = current_clinic_id() AND current_clinic_has_feature('templates'))
  WITH CHECK (clinic_id = current_clinic_id() AND current_clinic_has_feature('templates'));

DROP POLICY IF EXISTS ai_agents_select ON public.ai_agents;
CREATE POLICY ai_agents_select ON public.ai_agents
  FOR SELECT TO authenticated
  USING (clinic_id = current_clinic_id() AND current_clinic_has_feature('agents'));

DROP POLICY IF EXISTS ai_agents_admin_write ON public.ai_agents;
CREATE POLICY ai_agents_admin_write ON public.ai_agents
  TO authenticated
  USING (clinic_id = current_clinic_id() AND is_clinic_admin() AND current_clinic_has_feature('agents'))
  WITH CHECK (clinic_id = current_clinic_id() AND is_clinic_admin() AND current_clinic_has_feature('agents'));

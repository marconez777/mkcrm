DROP POLICY IF EXISTS clinic_scoped ON public.ai_agents;

CREATE POLICY ai_agents_select ON public.ai_agents
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());

CREATE POLICY ai_agents_admin_write ON public.ai_agents
FOR ALL TO authenticated
USING (
  public.is_super_admin()
  OR (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
)
WITH CHECK (
  public.is_super_admin()
  OR (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
);
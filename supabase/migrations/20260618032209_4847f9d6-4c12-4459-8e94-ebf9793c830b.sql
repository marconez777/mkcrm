
-- Allowlist
CREATE TABLE public.pipeline_automation_allowlist (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pipeline_automation_allowlist TO authenticated;
GRANT ALL ON public.pipeline_automation_allowlist TO service_role;
ALTER TABLE public.pipeline_automation_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allowlist_select_member_or_admin" ON public.pipeline_automation_allowlist
  FOR SELECT TO authenticated
  USING (is_super_admin() OR clinic_id = current_clinic_id());
CREATE POLICY "allowlist_super_admin_write" ON public.pipeline_automation_allowlist
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE TRIGGER trg_allowlist_updated_at BEFORE UPDATE ON public.pipeline_automation_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.pipeline_automation_allowlist (clinic_id, enabled, notes)
VALUES ('cf038458-457d-4c1a-9ac4-c88c3c8353a1', true, 'Clínica ÓR - validação inicial do agente de pipeline');

-- Helper
CREATE OR REPLACE FUNCTION public.is_pipeline_automation_allowed(_clinic_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_automation_allowlist
    WHERE clinic_id = _clinic_id AND enabled = true
  );
$$;

-- Runs
CREATE TABLE public.pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  pipeline_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','error','cancelled')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_run_id uuid REFERENCES public.pipeline_runs(id) ON DELETE SET NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text,
  started_at timestamptz,
  finished_at timestamptz,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.pipeline_runs TO authenticated;
GRANT ALL ON public.pipeline_runs TO service_role;
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs_select_clinic" ON public.pipeline_runs
  FOR SELECT TO authenticated
  USING (is_super_admin() OR clinic_id = current_clinic_id());
CREATE POLICY "runs_insert_clinic_admin" ON public.pipeline_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin() OR (
      clinic_id = current_clinic_id()
      AND is_clinic_admin()
      AND public.is_pipeline_automation_allowed(clinic_id)
    )
  );
CREATE POLICY "runs_update_clinic_admin" ON public.pipeline_runs
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR (clinic_id = current_clinic_id() AND is_clinic_admin()))
  WITH CHECK (is_super_admin() OR (clinic_id = current_clinic_id() AND is_clinic_admin()));
CREATE UNIQUE INDEX uniq_pipeline_runs_active_per_clinic
  ON public.pipeline_runs(clinic_id) WHERE status IN ('queued','running');
CREATE INDEX idx_pipeline_runs_clinic_created ON public.pipeline_runs(clinic_id, created_at DESC);
CREATE TRIGGER trg_runs_updated_at BEFORE UPDATE ON public.pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Run items
CREATE TABLE public.pipeline_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  stage_id uuid,
  stage_name text,
  step text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ok','skipped','error')),
  result jsonb,
  error text,
  comment text,
  retry_requested boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.pipeline_run_items TO authenticated;
GRANT ALL ON public.pipeline_run_items TO service_role;
ALTER TABLE public.pipeline_run_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "run_items_select_clinic" ON public.pipeline_run_items
  FOR SELECT TO authenticated
  USING (is_super_admin() OR clinic_id = current_clinic_id());
-- only allow updating comment / retry flag from the client
CREATE POLICY "run_items_update_comment" ON public.pipeline_run_items
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR (clinic_id = current_clinic_id() AND is_clinic_admin()))
  WITH CHECK (is_super_admin() OR (clinic_id = current_clinic_id() AND is_clinic_admin()));
CREATE INDEX idx_run_items_run ON public.pipeline_run_items(run_id, created_at);
CREATE INDEX idx_run_items_run_status ON public.pipeline_run_items(run_id, status);
CREATE INDEX idx_run_items_lead ON public.pipeline_run_items(lead_id);
CREATE TRIGGER trg_run_items_updated_at BEFORE UPDATE ON public.pipeline_run_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

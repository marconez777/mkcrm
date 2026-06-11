
CREATE TABLE IF NOT EXISTS public.pipeline_field_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT current_clinic_id() REFERENCES public.clinics(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  target_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_field_rules TO authenticated;
GRANT ALL ON public.pipeline_field_rules TO service_role;

ALTER TABLE public.pipeline_field_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field_rules_tenant_all"
  ON public.pipeline_field_rules
  FOR ALL
  TO authenticated
  USING (clinic_id = current_clinic_id() OR is_super_admin())
  WITH CHECK (clinic_id = current_clinic_id() OR is_super_admin());

CREATE INDEX IF NOT EXISTS idx_field_rules_pipeline
  ON public.pipeline_field_rules (pipeline_id, priority DESC)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_field_rules_clinic
  ON public.pipeline_field_rules (clinic_id);

CREATE OR REPLACE FUNCTION public.tg_field_rules_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_field_rules_touch ON public.pipeline_field_rules;
CREATE TRIGGER trg_field_rules_touch
  BEFORE UPDATE ON public.pipeline_field_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_field_rules_touch();


-- 1) Renames
UPDATE public.pipeline_stages SET name = '1ª Sessão Finalizada'
 WHERE id = '2a352661-01e2-41f8-be10-032f803e2387';

UPDATE public.pipeline_stages SET name = 'Nutrição Inativa (Geladeira de Leads)'
 WHERE id = '64356dbe-3889-4b49-9429-260501cdb3d8';

-- 2) Nova stage
INSERT INTO public.pipeline_stages (id, pipeline_id, clinic_id, name, position, color, is_terminal, lock_auto_move)
SELECT gen_random_uuid(),
       '17c27f4d-8256-4ea7-b5b9-ed706494f686',
       'cf038458-457d-4c1a-9ac4-c88c3c8353a1',
       'Nutrição Antigos (>60d)',
       11, '#94a3b8', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_stages
   WHERE pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
     AND name = 'Nutrição Antigos (>60d)'
);

-- 3) Aliases canônicos
INSERT INTO public.stage_canonical_aliases (clinic_id, pipeline_id, stage_id, canonical_name)
VALUES
  ('cf038458-457d-4c1a-9ac4-c88c3c8353a1','17c27f4d-8256-4ea7-b5b9-ed706494f686','2a352661-01e2-41f8-be10-032f803e2387','em_tratamento'),
  ('cf038458-457d-4c1a-9ac4-c88c3c8353a1','17c27f4d-8256-4ea7-b5b9-ed706494f686','2a352661-01e2-41f8-be10-032f803e2387','primeira_sessao_finalizada'),
  ('cf038458-457d-4c1a-9ac4-c88c3c8353a1','17c27f4d-8256-4ea7-b5b9-ed706494f686','64356dbe-3889-4b49-9429-260501cdb3d8','nutricao_inativa'),
  ('cf038458-457d-4c1a-9ac4-c88c3c8353a1','17c27f4d-8256-4ea7-b5b9-ed706494f686','64356dbe-3889-4b49-9429-260501cdb3d8','geladeira_de_leads')
ON CONFLICT DO NOTHING;

INSERT INTO public.stage_canonical_aliases (clinic_id, pipeline_id, stage_id, canonical_name)
SELECT 'cf038458-457d-4c1a-9ac4-c88c3c8353a1','17c27f4d-8256-4ea7-b5b9-ed706494f686', ps.id, 'nutricao_antigos'
  FROM public.pipeline_stages ps
 WHERE ps.pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
   AND ps.name = 'Nutrição Antigos (>60d)'
ON CONFLICT DO NOTHING;

-- 4) auto_tag_on_enter
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS auto_tag_on_enter text[] NOT NULL DEFAULT '{}'::text[];

-- 5) Trigger aplica tags ao lead
CREATE OR REPLACE FUNCTION public.apply_stage_auto_tags()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tags text[];
BEGIN
  SELECT auto_tag_on_enter INTO v_tags FROM public.pipeline_stages WHERE id = NEW.to_stage_id;
  IF v_tags IS NULL OR array_length(v_tags,1) IS NULL THEN RETURN NEW; END IF;
  UPDATE public.leads
     SET tags = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || v_tags)))
   WHERE id = NEW.lead_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_apply_stage_auto_tags ON public.lead_stage_history;
CREATE TRIGGER trg_apply_stage_auto_tags
AFTER INSERT ON public.lead_stage_history
FOR EACH ROW EXECUTE FUNCTION public.apply_stage_auto_tags();

-- 6) clinic_monthly_reports
CREATE TABLE IF NOT EXISTS public.clinic_monthly_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  report_kind   text NOT NULL DEFAULT 'finalizados_mensal_or',
  report_month  date NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_sent_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, report_kind, report_month)
);

GRANT SELECT ON public.clinic_monthly_reports TO authenticated;
GRANT ALL    ON public.clinic_monthly_reports TO service_role;

ALTER TABLE public.clinic_monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic members read own monthly reports"
ON public.clinic_monthly_reports FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clinic_members cm
     WHERE cm.clinic_id = clinic_monthly_reports.clinic_id
       AND cm.user_id   = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_clinic_monthly_reports_touch ON public.clinic_monthly_reports;
CREATE TRIGGER trg_clinic_monthly_reports_touch
BEFORE UPDATE ON public.clinic_monthly_reports
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_clinic_monthly_reports_clinic_month
  ON public.clinic_monthly_reports (clinic_id, report_month DESC);


-- 1. Flags de sistema em pipelines
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS system_key text;
CREATE UNIQUE INDEX IF NOT EXISTS pipelines_clinic_system_key_uniq
  ON public.pipelines (clinic_id, system_key) WHERE system_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_pipeline_system_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.is_system THEN
    RAISE EXCEPTION 'Pipeline do sistema não pode ser excluído';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_guard_pipeline_system_delete ON public.pipelines;
CREATE TRIGGER trg_guard_pipeline_system_delete
  BEFORE DELETE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.guard_pipeline_system_delete();

-- 2. Flags de sistema em email_segments
ALTER TABLE public.email_segments ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE public.email_segments ADD COLUMN IF NOT EXISTS system_key text;
CREATE UNIQUE INDEX IF NOT EXISTS email_segments_clinic_system_key_uniq
  ON public.email_segments (clinic_id, system_key) WHERE system_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_segment_system_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.is_system THEN
    RAISE EXCEPTION 'Lista de e-mail do sistema não pode ser excluída';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_guard_segment_system_delete ON public.email_segments;
CREATE TRIGGER trg_guard_segment_system_delete
  BEFORE DELETE ON public.email_segments
  FOR EACH ROW EXECUTE FUNCTION public.guard_segment_system_delete();

-- 3. Roteamento de lista por formulário
ALTER TABLE public.form_definitions
  ADD COLUMN IF NOT EXISTS default_email_segment_id uuid
  REFERENCES public.email_segments(id) ON DELETE SET NULL;

-- 4. Provisionamento idempotente por clínica
CREATE OR REPLACE FUNCTION public.ensure_system_form_assets(_clinic_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pipeline_id uuid;
  _stage_id uuid;
  _segment_id uuid;
  _max_pos int;
BEGIN
  -- Pipeline "Formulário Site"
  SELECT id INTO _pipeline_id FROM public.pipelines
    WHERE clinic_id = _clinic_id AND system_key = 'forms_site';
  IF _pipeline_id IS NULL THEN
    SELECT COALESCE(MAX(position), -1) + 1 INTO _max_pos
      FROM public.pipelines WHERE clinic_id = _clinic_id;
    INSERT INTO public.pipelines (clinic_id, name, kind, color, position, is_system, system_key, is_default)
    VALUES (_clinic_id, 'Formulário Site', 'sales', '#10b981', _max_pos, true, 'forms_site', false)
    RETURNING id INTO _pipeline_id;
  END IF;

  -- Stage "Novo" dentro do pipeline
  SELECT id INTO _stage_id FROM public.pipeline_stages
    WHERE pipeline_id = _pipeline_id ORDER BY position ASC LIMIT 1;
  IF _stage_id IS NULL THEN
    INSERT INTO public.pipeline_stages (clinic_id, pipeline_id, name, position, color)
    VALUES (_clinic_id, _pipeline_id, 'Novo', 0, '#10b981')
    RETURNING id INTO _stage_id;
  END IF;

  -- Segment (lista) "Leads Site" estática
  SELECT id INTO _segment_id FROM public.email_segments
    WHERE clinic_id = _clinic_id AND system_key = 'leads_site';
  IF _segment_id IS NULL THEN
    INSERT INTO public.email_segments (clinic_id, name, description, filters, is_system, system_key, active)
    VALUES (_clinic_id, 'Leads Site', 'Leads recebidos pelos formulários do site (auto)', '{"kind":"static"}'::jsonb, true, 'leads_site', true)
    RETURNING id INTO _segment_id;
  END IF;
END $$;

-- 5. Backfill em todas as clínicas existentes
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id FROM public.clinics LOOP
    PERFORM public.ensure_system_form_assets(c.id);
  END LOOP;
END $$;

-- 6. Trigger para novas clínicas
CREATE OR REPLACE FUNCTION public.tg_clinic_after_insert_system_assets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ensure_system_form_assets(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clinic_after_insert_system_assets ON public.clinics;
CREATE TRIGGER trg_clinic_after_insert_system_assets
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.tg_clinic_after_insert_system_assets();

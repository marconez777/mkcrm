CREATE OR REPLACE FUNCTION public.leads_enforce_clinic_pipeline_stage_coherence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_clinic uuid;
  v_stage_pipeline  uuid;
BEGIN
  IF NEW.pipeline_id IS NOT NULL THEN
    SELECT clinic_id INTO v_pipeline_clinic FROM public.pipelines WHERE id = NEW.pipeline_id;
    IF v_pipeline_clinic IS NULL THEN
      RAISE EXCEPTION 'pipeline_id % does not exist', NEW.pipeline_id;
    END IF;
    IF NEW.clinic_id IS NOT NULL AND v_pipeline_clinic <> NEW.clinic_id THEN
      RAISE EXCEPTION 'pipeline_id % belongs to clinic %, not lead.clinic_id %', NEW.pipeline_id, v_pipeline_clinic, NEW.clinic_id;
    END IF;
  END IF;

  IF NEW.stage_id IS NOT NULL THEN
    SELECT pipeline_id INTO v_stage_pipeline FROM public.pipeline_stages WHERE id = NEW.stage_id;
    IF v_stage_pipeline IS NULL THEN
      RAISE EXCEPTION 'stage_id % does not exist', NEW.stage_id;
    END IF;
    IF NEW.pipeline_id IS NOT NULL AND v_stage_pipeline <> NEW.pipeline_id THEN
      RAISE EXCEPTION 'stage_id % belongs to pipeline %, not lead.pipeline_id %', NEW.stage_id, v_stage_pipeline, NEW.pipeline_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_enforce_coherence ON public.leads;
CREATE TRIGGER trg_leads_enforce_coherence
BEFORE INSERT OR UPDATE OF clinic_id, pipeline_id, stage_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_enforce_clinic_pipeline_stage_coherence();
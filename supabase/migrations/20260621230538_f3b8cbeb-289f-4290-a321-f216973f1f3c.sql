
-- Parte A: snapshot + move 2 leads MKart residuais do pipeline ÓR para o pipeline MKart
INSERT INTO public.lead_stage_history (lead_id, clinic_id, from_stage_id, to_stage_id, reason, source, moved_at)
SELECT id, clinic_id, stage_id, 'f2ab32fd-de68-4ef9-82fd-2cf431e63858'::uuid,
       'correcao_cross_clinic_or_to_mkart_residual', 'system_migration', now()
FROM public.leads
WHERE clinic_id   = 'd0a57fa2-10f2-4d86-888f-39f5d977705d'
  AND pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686';

UPDATE public.leads
SET pipeline_id      = '7ee3b834-d4a4-4a5b-a235-2fd1e8fced76',
    stage_id         = 'f2ab32fd-de68-4ef9-82fd-2cf431e63858',
    stage_changed_at = now(),
    updated_at       = now()
WHERE clinic_id   = 'd0a57fa2-10f2-4d86-888f-39f5d977705d'
  AND pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686';

-- Parte B.3: marcar automation_runs cross-clinic históricos
UPDATE public.automation_runs ar
SET status = 'failed_cross_clinic',
    detail = LEFT('cross_clinic_retro_audit | ' || COALESCE(ar.detail, ''), 500)
FROM public.automations a, public.leads l
WHERE ar.automation_id = a.id
  AND ar.lead_id       = l.id
  AND a.clinic_id      <> l.clinic_id
  AND ar.status        <> 'failed_cross_clinic';

-- Parte B.4: trigger preventivo em automation_runs
CREATE OR REPLACE FUNCTION public.enforce_automation_run_clinic_coherence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a_clinic uuid;
  l_clinic uuid;
BEGIN
  SELECT clinic_id INTO a_clinic FROM public.automations WHERE id = NEW.automation_id;
  SELECT clinic_id INTO l_clinic FROM public.leads       WHERE id = NEW.lead_id;
  IF a_clinic IS NOT NULL AND l_clinic IS NOT NULL AND a_clinic <> l_clinic THEN
    RAISE EXCEPTION 'cross-clinic automation_run blocked: automation_clinic=% lead_clinic=%', a_clinic, l_clinic
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_automation_runs_clinic_coherence ON public.automation_runs;
CREATE TRIGGER trg_automation_runs_clinic_coherence
BEFORE INSERT OR UPDATE OF automation_id, lead_id ON public.automation_runs
FOR EACH ROW EXECUTE FUNCTION public.enforce_automation_run_clinic_coherence();

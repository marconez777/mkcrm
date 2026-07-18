CREATE OR REPLACE FUNCTION public.fn_clinica_or_wakeup_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead record;
  v_old_stage uuid;
  v_new_stage uuid := 'c6eb67f3-cba9-41e5-949c-aa12d34d962d'::uuid;
BEGIN
  BEGIN
    IF NEW.from_me = true THEN
      RETURN NEW;
    END IF;

    SELECT id, clinic_id, stage_id, tags
      INTO v_lead
      FROM public.leads
     WHERE id = NEW.lead_id
       AND clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'::uuid;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    v_old_stage := v_lead.stage_id;

    IF v_old_stage IN (
      '9f408ae6-649e-44b2-bc56-f93d138c87ed'::uuid,
      '64356dbe-3889-4b49-9429-260501cdb3d8'::uuid,
      '9de8e54e-7edb-47dd-b613-de22276d8ea1'::uuid
    ) THEN
      UPDATE public.leads
         SET stage_id = v_new_stage,
             stage_changed_at = now(),
             updated_at = now(),
             tags = ARRAY(SELECT DISTINCT unnest(COALESCE(v_lead.tags, '{}'::text[]) || ARRAY['reativacao']))
       WHERE id = v_lead.id;

      INSERT INTO public.lead_stage_history (
        lead_id, clinic_id, from_stage_id, to_stage_id, reason, source, moved_at
      ) VALUES (
        v_lead.id, v_lead.clinic_id, v_old_stage, v_new_stage,
        'Paciente voltou a responder (Reativação automática)',
        'auto:wakeup-trigger', now()
      )
      ON CONFLICT (lead_id, to_stage_id, moved_at) DO NOTHING;
    END IF;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_clinica_or_wakeup_inbound failed (lead=%): %', NEW.lead_id, SQLERRM;
    RETURN NEW;
  END;
END;
$$;
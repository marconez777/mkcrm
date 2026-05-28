-- Allow new trigger type 'pipeline_enter'
ALTER TABLE public.message_sequences DROP CONSTRAINT IF EXISTS message_sequences_trigger_type_check;
ALTER TABLE public.message_sequences ADD CONSTRAINT message_sequences_trigger_type_check
  CHECK (trigger_type IN ('stage_enter','pipeline_enter','webhook','manual'));

-- Recreate enrollment function: fire on INSERT and on stage UPDATE, for stage_enter + pipeline_enter
CREATE OR REPLACE FUNCTION public.enroll_lead_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq RECORD;
  cooldown_cutoff timestamptz;
  new_pipeline_id uuid;
  old_pipeline_id uuid;
  stage_changed boolean;
  pipeline_changed boolean;
BEGIN
  IF NEW.stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pipeline_id INTO new_pipeline_id FROM public.pipeline_stages WHERE id = NEW.stage_id;
  IF new_pipeline_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    stage_changed := true;
    pipeline_changed := true;
  ELSE
    stage_changed := NEW.stage_id IS DISTINCT FROM OLD.stage_id;
    IF OLD.stage_id IS NOT NULL THEN
      SELECT pipeline_id INTO old_pipeline_id FROM public.pipeline_stages WHERE id = OLD.stage_id;
    END IF;
    pipeline_changed := new_pipeline_id IS DISTINCT FROM old_pipeline_id;
    IF NOT stage_changed AND NOT pipeline_changed THEN
      RETURN NEW;
    END IF;
  END IF;

  FOR seq IN
    SELECT id, cooldown_days, trigger_type
    FROM public.message_sequences
    WHERE clinic_id = NEW.clinic_id
      AND enabled = true
      AND (
        (trigger_type = 'stage_enter' AND stage_changed AND (trigger_config->>'stage_id')::uuid = NEW.stage_id)
        OR
        (trigger_type = 'pipeline_enter' AND pipeline_changed AND (trigger_config->>'pipeline_id')::uuid = new_pipeline_id)
      )
  LOOP
    cooldown_cutoff := now() - make_interval(days => seq.cooldown_days);
    IF EXISTS (
      SELECT 1 FROM public.message_sequence_enrollments
      WHERE sequence_id = seq.id AND lead_id = NEW.id
        AND started_at > cooldown_cutoff
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.message_sequence_enrollments
      (clinic_id, sequence_id, lead_id, status, current_step, next_run_at, source)
    VALUES
      (NEW.clinic_id, seq.id, NEW.id, 'active', 0, now(),
       jsonb_build_object(
         'trigger', seq.trigger_type,
         'stage_id', NEW.stage_id,
         'pipeline_id', new_pipeline_id,
         'op', TG_OP
       ));
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enroll_on_stage_change ON public.leads;
CREATE TRIGGER trg_enroll_on_stage_change
  AFTER INSERT OR UPDATE OF stage_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enroll_lead_on_stage_change();
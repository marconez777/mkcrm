ALTER TABLE public.lead_events ADD COLUMN IF NOT EXISTS actor_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_lead_events_actor_created ON public.lead_events(actor_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  k text;
  changes jsonb := '{}'::jsonb;
  old_cf jsonb := COALESCE(OLD.custom_fields, '{}'::jsonb);
  new_cf jsonb := COALESCE(NEW.custom_fields, '{}'::jsonb);
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.lead_events(lead_id, type, payload, actor_user_id, clinic_id)
    VALUES (NEW.id, 'stage_changed',
      jsonb_build_object('from', OLD.stage_id, 'to', NEW.stage_id),
      actor, NEW.clinic_id);
  END IF;

  IF NEW.attendant_id IS DISTINCT FROM OLD.attendant_id THEN
    INSERT INTO public.lead_events(lead_id, type, payload, actor_user_id, clinic_id)
    VALUES (NEW.id, 'attendant_changed',
      jsonb_build_object('from', OLD.attendant_id, 'to', NEW.attendant_id),
      actor, NEW.clinic_id);
  END IF;

  IF NEW.custom_fields IS DISTINCT FROM OLD.custom_fields THEN
    FOR k IN
      SELECT DISTINCT key FROM (
        SELECT jsonb_object_keys(old_cf) AS key
        UNION
        SELECT jsonb_object_keys(new_cf) AS key
      ) s
    LOOP
      v_old := old_cf -> k;
      v_new := new_cf -> k;
      IF v_old IS DISTINCT FROM v_new THEN
        changes := changes || jsonb_build_object(k, jsonb_build_object('from', v_old, 'to', v_new));
      END IF;
    END LOOP;

    IF changes <> '{}'::jsonb THEN
      INSERT INTO public.lead_events(lead_id, type, payload, actor_user_id, clinic_id)
      VALUES (NEW.id, 'custom_fields_changed',
        jsonb_build_object('changes', changes),
        actor, NEW.clinic_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_lead_changes_trg ON public.leads;
CREATE TRIGGER log_lead_changes_trg AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_changes();
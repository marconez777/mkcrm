
CREATE OR REPLACE FUNCTION public.log_lead_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.lead_events(lead_id, type, payload, clinic_id)
    VALUES (NEW.id, 'stage_changed', jsonb_build_object('from', OLD.stage_id, 'to', NEW.stage_id), NEW.clinic_id);
  END IF;
  IF NEW.attendant_id IS DISTINCT FROM OLD.attendant_id THEN
    INSERT INTO public.lead_events(lead_id, type, payload, clinic_id)
    VALUES (NEW.id, 'attendant_changed', jsonb_build_object('from', OLD.attendant_id, 'to', NEW.attendant_id), NEW.clinic_id);
  END IF;
  RETURN NEW;
END;
$function$;

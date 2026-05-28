
CREATE OR REPLACE FUNCTION public.tg_suppress_on_bounce()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.bounced_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.bounced_at IS NULL)
     AND NEW.recipient_email IS NOT NULL
     AND NEW.recipient_email <> '' THEN

    INSERT INTO public.email_unsubscribes (clinic_id, email, reason, source)
    VALUES (NEW.clinic_id, lower(NEW.recipient_email), 'bounce', 'auto-bounce-trigger')
    ON CONFLICT (clinic_id, email) DO NOTHING;

    DELETE FROM public.email_segment_contacts
    WHERE clinic_id = NEW.clinic_id
      AND lower(email) = lower(NEW.recipient_email);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_email_logs_suppress_on_bounce ON public.email_logs;
CREATE TRIGGER trg_email_logs_suppress_on_bounce
AFTER INSERT OR UPDATE OF bounced_at ON public.email_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_suppress_on_bounce();

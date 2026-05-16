
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;
ALTER TABLE public.email_segments ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.cancel_pending_emails_for(_clinic_id uuid, _email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.email_queue
  SET status = 'cancelled',
      error = COALESCE(error, '') || ' [auto-cancelled: unsubscribed]',
      updated_at = now()
  WHERE clinic_id = _clinic_id
    AND lower(recipient_email) = lower(_email)
    AND status = 'pending'
    AND force_send = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.tg_cancel_pending_on_unsubscribe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.cancel_pending_emails_for(NEW.clinic_id, NEW.email);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cancel_pending_on_unsubscribe ON public.email_unsubscribes;
CREATE TRIGGER trg_cancel_pending_on_unsubscribe
  AFTER INSERT ON public.email_unsubscribes
  FOR EACH ROW EXECUTE FUNCTION public.tg_cancel_pending_on_unsubscribe();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='email_queue'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.email_queue';
  END IF;
END $$;

ALTER TABLE public.email_queue REPLICA IDENTITY FULL;

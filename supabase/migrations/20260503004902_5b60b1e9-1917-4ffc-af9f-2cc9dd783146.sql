
CREATE TABLE public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut text NOT NULL UNIQUE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.quick_replies FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_quick_replies_updated_at BEFORE UPDATE ON public.quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.lead_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX lead_events_lead_idx ON public.lead_events(lead_id, created_at DESC);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivery_status text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_external_id text;

CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.lead_events(lead_id, type, payload)
    VALUES (NEW.id, 'stage_changed', jsonb_build_object('from', OLD.stage_id, 'to', NEW.stage_id));
  END IF;
  IF NEW.attendant_id IS DISTINCT FROM OLD.attendant_id THEN
    INSERT INTO public.lead_events(lead_id, type, payload)
    VALUES (NEW.id, 'attendant_changed', jsonb_build_object('from', OLD.attendant_id, 'to', NEW.attendant_id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_lead_changes_trg ON public.leads;
CREATE TRIGGER log_lead_changes_trg AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_changes();

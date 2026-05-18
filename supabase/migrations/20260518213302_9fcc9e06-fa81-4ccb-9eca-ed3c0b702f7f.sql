
CREATE TABLE IF NOT EXISTS public.whatsapp_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  visitor_id text,
  session_id text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  tracking_code text NOT NULL,
  phone_destination text,
  source text,
  medium text,
  campaign text,
  utm_content text,
  utm_term text,
  landing_page text,
  referrer text,
  user_agent text,
  status text NOT NULL DEFAULT 'pending',
  clicked_at timestamptz NOT NULL DEFAULT now(),
  matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_intents_status_check CHECK (status IN ('pending','matched','expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_intents_clinic_code_uq
  ON public.whatsapp_intents (clinic_id, tracking_code);
CREATE INDEX IF NOT EXISTS whatsapp_intents_clinic_visitor_idx
  ON public.whatsapp_intents (clinic_id, visitor_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_intents_clinic_phone_idx
  ON public.whatsapp_intents (clinic_id, phone_destination, clicked_at DESC);

ALTER TABLE public.whatsapp_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_intents_select" ON public.whatsapp_intents
  FOR SELECT USING (has_clinic_access(clinic_id));
CREATE POLICY "whatsapp_intents_write" ON public.whatsapp_intents
  FOR ALL USING (has_clinic_access(clinic_id))
  WITH CHECK (has_clinic_access(clinic_id));

CREATE TRIGGER set_updated_at_whatsapp_intents
  BEFORE UPDATE ON public.whatsapp_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tracking_sessions ADD COLUMN IF NOT EXISTS ctwa_clid text;
ALTER TABLE public.tracking_lead_sources ADD COLUMN IF NOT EXISTS ctwa_clid text;
CREATE INDEX IF NOT EXISTS tracking_sessions_ctwa_idx
  ON public.tracking_sessions (clinic_id, ctwa_clid) WHERE ctwa_clid IS NOT NULL;

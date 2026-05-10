-- Tracking sites: one per monitored website
CREATE TABLE public.tracking_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT current_clinic_id(),
  name text NOT NULL,
  domain text NOT NULL,
  ingest_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tracking_sites_token_idx ON public.tracking_sites(ingest_token);
ALTER TABLE public.tracking_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinic_scoped ON public.tracking_sites FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id()) WITH CHECK (clinic_id = current_clinic_id());

-- Tracking sessions: one per anonymous visitor
CREATE TABLE public.tracking_sessions (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES public.tracking_sites(id) ON DELETE CASCADE,
  ref text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  first_url text,
  first_referrer text,
  landing_title text,
  user_agent text,
  device text,
  country text,
  ip_hash text,
  lead_id uuid,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracking_sessions_ref_idx ON public.tracking_sessions(clinic_id, ref) WHERE ref IS NOT NULL;
CREATE INDEX tracking_sessions_lead_idx ON public.tracking_sessions(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX tracking_sessions_clinic_created_idx ON public.tracking_sessions(clinic_id, created_at DESC);
ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinic_scoped ON public.tracking_sessions FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id()) WITH CHECK (clinic_id = current_clinic_id());

-- Tracking events
CREATE TABLE public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.tracking_sessions(id) ON DELETE CASCADE,
  type text NOT NULL,
  url text,
  title text,
  referrer text,
  payload jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracking_events_session_idx ON public.tracking_events(session_id, occurred_at);
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinic_scoped ON public.tracking_events FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id()) WITH CHECK (clinic_id = current_clinic_id());

-- Add origin tracking columns to leads
ALTER TABLE public.leads
  ADD COLUMN origin_source text,
  ADD COLUMN origin_confidence text,
  ADD COLUMN tracking_session_id uuid;
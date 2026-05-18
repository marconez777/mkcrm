
-- tracking_visitors
CREATE TABLE public.tracking_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  visitor_id text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  first_landing_page text,
  first_referrer text,
  first_source text,
  first_medium text,
  first_campaign text,
  device_type text,
  browser text,
  operating_system text,
  consent_status text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, visitor_id)
);

ALTER TABLE public.tracking_visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_scoped ON public.tracking_visitors
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE TRIGGER set_updated_at_tracking_visitors
  BEFORE UPDATE ON public.tracking_visitors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- tracking_sessions
CREATE TABLE public.tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  session_id text NOT NULL,
  visitor_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  landing_page text,
  referrer text,
  source text,
  medium text,
  campaign text,
  utm_content text,
  utm_term text,
  gclid text,
  fbclid text,
  msclkid text,
  gbraid text,
  wbraid text,
  device_type text,
  browser text,
  operating_system text,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, session_id)
);

ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_scoped ON public.tracking_sessions
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE INDEX idx_tracking_sessions_visitor
  ON public.tracking_sessions (clinic_id, visitor_id, started_at DESC);

CREATE TRIGGER set_updated_at_tracking_sessions
  BEFORE UPDATE ON public.tracking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- tracking_events
CREATE TABLE public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  event_id text NOT NULL,
  visitor_id text NOT NULL,
  session_id text,
  lead_id uuid,
  event_name text NOT NULL,
  event_type text NOT NULL DEFAULT 'custom',
  event_time timestamptz NOT NULL DEFAULT now(),
  page_url text,
  page_path text,
  page_title text,
  referrer text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, event_id)
);

ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_scoped ON public.tracking_events
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE INDEX idx_tracking_events_visitor
  ON public.tracking_events (clinic_id, visitor_id, event_time DESC);

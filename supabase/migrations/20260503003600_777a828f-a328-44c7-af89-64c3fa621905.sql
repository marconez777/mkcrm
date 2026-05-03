
-- Messages: dedup + retry tracking
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS client_message_id uuid,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE UNIQUE INDEX IF NOT EXISTS messages_lead_external_unique
  ON public.messages(lead_id, external_id) WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS messages_client_id_unique
  ON public.messages(client_message_id) WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_lead_timestamp_idx
  ON public.messages(lead_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS messages_status_idx
  ON public.messages(status) WHERE status IN ('pending','failed');

-- Settings: health tracking
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS connection_state text,
  ADD COLUMN IF NOT EXISTS last_health_check timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_ok boolean,
  ADD COLUMN IF NOT EXISTS webhook_last_error text,
  ADD COLUMN IF NOT EXISTS webhook_last_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_poll_at timestamptz;

-- Webhook events audit table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text,
  lead_id uuid,
  source text NOT NULL DEFAULT 'webhook'
);

CREATE INDEX IF NOT EXISTS webhook_events_received_idx
  ON public.webhook_events(received_at DESC);

CREATE INDEX IF NOT EXISTS webhook_events_error_idx
  ON public.webhook_events(received_at DESC) WHERE error IS NOT NULL;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON public.webhook_events
  FOR ALL USING (true) WITH CHECK (true);

-- Atomic unread increment
CREATE OR REPLACE FUNCTION public.increment_unread(p_lead_id uuid, p_preview text, p_ts timestamptz)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.leads
  SET unread_count = COALESCE(unread_count, 0) + 1,
      last_message_at = GREATEST(COALESCE(last_message_at, p_ts), p_ts),
      last_message_preview = p_preview
  WHERE id = p_lead_id;
END;
$$;

-- Cleanup old webhook events (called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_webhook_events()
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  DELETE FROM public.webhook_events WHERE received_at < now() - interval '14 days';
$$;

-- Enable realtime for new things
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_events;

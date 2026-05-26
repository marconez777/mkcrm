
-- R-2: Composite index for email_logs idempotency lookups (send-email checks per recipient/template/table)
CREATE INDEX IF NOT EXISTS email_logs_idempotency_idx
  ON public.email_logs (clinic_id, template_slug, lower(recipient_email), related_lead_table)
  WHERE related_lead_table IS NOT NULL;

-- R-2: Speed up reaper sweeps of stuck "processing" jobs
CREATE INDEX IF NOT EXISTS email_queue_processing_idx
  ON public.email_queue (updated_at)
  WHERE status = 'processing';

-- R-2: Speed up bulk status updates by id+status
CREATE INDEX IF NOT EXISTS email_queue_status_idx
  ON public.email_queue (status);

-- R-5: Webhook dedup table for Resend (Svix delivery id is the natural key)
CREATE TABLE IF NOT EXISTS public.resend_webhook_events (
  svix_id text PRIMARY KEY,
  event_type text,
  resend_id text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resend_webhook_events_received_idx
  ON public.resend_webhook_events (received_at);

ALTER TABLE public.resend_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service-role can read/write; no public policies needed.

-- R-1: Bump cron frequency. pg_cron supports sub-minute via "N seconds" syntax.
DO $$
DECLARE _jobid bigint;
BEGIN
  SELECT jobid INTO _jobid FROM cron.job WHERE jobname = 'process-email-queue-every-minute';
  IF _jobid IS NOT NULL THEN
    PERFORM cron.alter_job(_jobid, schedule => '15 seconds');
  END IF;
END $$;

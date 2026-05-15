
CREATE TABLE public.external_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  endpoint text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_status_code int,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, endpoint)
);

CREATE INDEX idx_ewd_pending ON public.external_webhook_deliveries (status, next_attempt_at) WHERE status = 'pending';

ALTER TABLE public.external_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ewd_admin_read" ON public.external_webhook_deliveries
  FOR SELECT TO authenticated
  USING (is_super_admin() OR ((clinic_id = current_clinic_id()) AND is_clinic_admin()));

CREATE TRIGGER trg_ewd_updated_at
BEFORE UPDATE ON public.external_webhook_deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

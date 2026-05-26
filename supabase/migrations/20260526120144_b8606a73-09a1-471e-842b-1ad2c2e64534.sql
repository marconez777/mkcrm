
-- R-7: prioridade na fila
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 5;

-- novo índice ordenado por prioridade + horário
CREATE INDEX IF NOT EXISTS email_queue_pending_priority_idx
  ON public.email_queue (priority ASC, scheduled_at ASC)
  WHERE status = 'pending';

-- R-10: tabela de dedup atômica (substitui SELECT+INSERT por INSERT ON CONFLICT)
CREATE TABLE IF NOT EXISTS public.email_send_dedup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  template_slug text NOT NULL,
  email text NOT NULL,
  context text NOT NULL,
  resend_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_send_dedup_uniq
  ON public.email_send_dedup (clinic_id, template_slug, lower(email), context);

CREATE INDEX IF NOT EXISTS email_send_dedup_created_idx
  ON public.email_send_dedup (created_at DESC);

ALTER TABLE public.email_send_dedup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_send_dedup_read ON public.email_send_dedup;
CREATE POLICY email_send_dedup_read ON public.email_send_dedup
  FOR SELECT TO authenticated
  USING (has_clinic_access(clinic_id));

-- R-7 + R-10: enqueue_email com prioridade
CREATE OR REPLACE FUNCTION public.enqueue_email(
  _clinic_id uuid,
  _template_slug text,
  _recipient_email text,
  _recipient_name text DEFAULT NULL,
  _variables jsonb DEFAULT '{}'::jsonb,
  _scheduled_at timestamptz DEFAULT now(),
  _related_lead_id uuid DEFAULT NULL,
  _related_lead_table text DEFAULT NULL,
  _force_send boolean DEFAULT false,
  _from_name_override text DEFAULT NULL,
  _priority smallint DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.email_queue (
    clinic_id, template_slug, recipient_email, recipient_name,
    variables, scheduled_at, related_lead_id, related_lead_table,
    force_send, from_name_override, priority, status
  ) VALUES (
    _clinic_id, _template_slug, lower(_recipient_email), _recipient_name,
    coalesce(_variables, '{}'::jsonb), _scheduled_at, _related_lead_id, _related_lead_table,
    _force_send, _from_name_override, coalesce(_priority, 5), 'pending'
  )
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- R-11: claim de cota atômico
CREATE OR REPLACE FUNCTION public.claim_email_quota(_clinic_id uuid)
RETURNS TABLE (allowed boolean, sent_today integer, quota integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quota integer;
  _new_count integer;
BEGIN
  _quota := COALESCE(public.clinic_email_quota(_clinic_id), 1000);

  -- upsert atômico; se quota expirou, reseta
  INSERT INTO public.email_send_state (clinic_id, sent_today, quota_resets_at, updated_at)
  VALUES (_clinic_id, 1, date_trunc('day', now()) + interval '1 day', now())
  ON CONFLICT (clinic_id) DO UPDATE
    SET sent_today = CASE
          WHEN public.email_send_state.quota_resets_at <= now()
            THEN 1
          ELSE public.email_send_state.sent_today + 1
        END,
        quota_resets_at = CASE
          WHEN public.email_send_state.quota_resets_at <= now()
            THEN date_trunc('day', now()) + interval '1 day'
          ELSE public.email_send_state.quota_resets_at
        END,
        updated_at = now()
  RETURNING email_send_state.sent_today INTO _new_count;

  IF _new_count > _quota THEN
    -- excedeu — decrementa para não "consumir" indevidamente
    UPDATE public.email_send_state
      SET sent_today = GREATEST(sent_today - 1, 0), updated_at = now()
      WHERE clinic_id = _clinic_id;
    RETURN QUERY SELECT false, _new_count - 1, _quota;
  ELSE
    RETURN QUERY SELECT true, _new_count, _quota;
  END IF;
END;
$$;

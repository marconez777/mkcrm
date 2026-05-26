
CREATE TABLE IF NOT EXISTS public.email_domain_warmup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  domain text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  current_day_window date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  sent_today integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, domain)
);
ALTER TABLE public.email_domain_warmup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warmup readable by clinic members"
  ON public.email_domain_warmup FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_clinic_access(clinic_id));

CREATE POLICY "warmup writable by clinic admins"
  ON public.email_domain_warmup FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.clinic_members
      WHERE user_id = auth.uid() AND clinic_id = email_domain_warmup.clinic_id
        AND role IN ('owner','admin')
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.clinic_members
      WHERE user_id = auth.uid() AND clinic_id = email_domain_warmup.clinic_id
        AND role IN ('owner','admin')
    )
  );

CREATE INDEX IF NOT EXISTS email_domain_warmup_clinic_domain_idx
  ON public.email_domain_warmup (clinic_id, domain);

CREATE TABLE IF NOT EXISTS public.email_recipient_throttle (
  clinic_id uuid NOT NULL,
  dest_domain text NOT NULL,
  window_start timestamptz NOT NULL,
  sent integer NOT NULL DEFAULT 0,
  PRIMARY KEY (clinic_id, dest_domain, window_start)
);
ALTER TABLE public.email_recipient_throttle ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS email_recipient_throttle_cleanup_idx
  ON public.email_recipient_throttle (window_start);

CREATE OR REPLACE FUNCTION public.claim_domain_warmup(
  _clinic_id uuid, _domain text
) RETURNS TABLE (allowed boolean, daily_cap integer, sent_today integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  row_warmup public.email_domain_warmup%ROWTYPE;
  day_index integer; cap integer;
  today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  SELECT * INTO row_warmup FROM public.email_domain_warmup
  WHERE clinic_id = _clinic_id AND domain = _domain FOR UPDATE;
  IF NOT FOUND OR NOT row_warmup.enabled THEN
    RETURN QUERY SELECT true, NULL::integer, 0; RETURN;
  END IF;
  IF row_warmup.current_day_window <> today THEN
    UPDATE public.email_domain_warmup
    SET current_day_window = today, sent_today = 0, updated_at = now()
    WHERE id = row_warmup.id RETURNING * INTO row_warmup;
  END IF;
  day_index := GREATEST(0, (today - (row_warmup.started_at AT TIME ZONE 'UTC')::date));
  cap := CASE
    WHEN day_index = 0 THEN 50
    WHEN day_index = 1 THEN 100
    WHEN day_index = 2 THEN 500
    WHEN day_index = 3 THEN 1000
    WHEN day_index BETWEEN 4 AND 6 THEN 5000
    WHEN day_index BETWEEN 7 AND 10 THEN 10000
    WHEN day_index BETWEEN 11 AND 13 THEN 25000
    ELSE NULL END;
  IF cap IS NULL THEN
    RETURN QUERY SELECT true, NULL::integer, row_warmup.sent_today; RETURN;
  END IF;
  IF row_warmup.sent_today >= cap THEN
    RETURN QUERY SELECT false, cap, row_warmup.sent_today; RETURN;
  END IF;
  UPDATE public.email_domain_warmup
  SET sent_today = sent_today + 1, updated_at = now()
  WHERE id = row_warmup.id
  RETURNING sent_today INTO row_warmup.sent_today;
  RETURN QUERY SELECT true, cap, row_warmup.sent_today;
END; $$;
REVOKE ALL ON FUNCTION public.claim_domain_warmup(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_domain_warmup(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.release_domain_warmup(_clinic_id uuid, _domain text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.email_domain_warmup
  SET sent_today = GREATEST(sent_today - 1, 0), updated_at = now()
  WHERE clinic_id = _clinic_id AND domain = _domain;
$$;
REVOKE ALL ON FUNCTION public.release_domain_warmup(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_domain_warmup(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_recipient_throttle(
  _clinic_id uuid, _dest_domain text, _limit_per_hour integer DEFAULT 1000
) RETURNS TABLE (allowed boolean, sent integer, window_start timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  win timestamptz := date_trunc('hour', now());
  cur integer;
BEGIN
  INSERT INTO public.email_recipient_throttle (clinic_id, dest_domain, window_start, sent)
  VALUES (_clinic_id, _dest_domain, win, 1)
  ON CONFLICT (clinic_id, dest_domain, window_start)
  DO UPDATE SET sent = email_recipient_throttle.sent + 1
  RETURNING sent INTO cur;
  IF cur > _limit_per_hour THEN
    UPDATE public.email_recipient_throttle
    SET sent = GREATEST(sent - 1, 0)
    WHERE clinic_id = _clinic_id AND dest_domain = _dest_domain AND window_start = win;
    RETURN QUERY SELECT false, cur - 1, win; RETURN;
  END IF;
  RETURN QUERY SELECT true, cur, win;
END; $$;
REVOKE ALL ON FUNCTION public.claim_recipient_throttle(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_recipient_throttle(uuid, text, integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.email_health_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  alert_type text NOT NULL,
  metric_value numeric NOT NULL,
  threshold numeric NOT NULL,
  sample_size integer NOT NULL,
  action_taken text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_health_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health alerts visible to clinic members"
  ON public.email_health_alerts FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_clinic_access(clinic_id));
CREATE INDEX IF NOT EXISTS email_health_alerts_clinic_idx
  ON public.email_health_alerts (clinic_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.check_clinic_bounce_health()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total integer; bounces integer; complaints integer;
  bounce_rate numeric; complaint_rate numeric;
  recent_alert_count integer;
BEGIN
  IF NEW.status NOT IN ('bounced','complained') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  SELECT count(*) INTO recent_alert_count
  FROM public.email_health_alerts
  WHERE clinic_id = NEW.clinic_id AND created_at > now() - interval '10 minutes';
  IF recent_alert_count > 0 THEN RETURN NEW; END IF;
  WITH recent AS (
    SELECT status FROM public.email_logs
    WHERE clinic_id = NEW.clinic_id
      AND status IN ('sent','delivered','opened','clicked','bounced','complained')
    ORDER BY created_at DESC LIMIT 1000
  )
  SELECT count(*),
         count(*) FILTER (WHERE status = 'bounced'),
         count(*) FILTER (WHERE status = 'complained')
  INTO total, bounces, complaints FROM recent;
  IF total < 50 THEN RETURN NEW; END IF;
  bounce_rate := bounces::numeric / total;
  complaint_rate := complaints::numeric / total;
  IF bounce_rate > 0.05 THEN
    UPDATE public.email_campaigns
      SET status = 'paused', updated_at = now()
      WHERE clinic_id = NEW.clinic_id AND status IN ('running','sending','scheduled');
    INSERT INTO public.email_health_alerts (clinic_id, alert_type, metric_value, threshold, sample_size, action_taken)
      VALUES (NEW.clinic_id, 'bounce_rate', bounce_rate, 0.05, total, 'campaigns paused');
  ELSIF complaint_rate > 0.003 THEN
    UPDATE public.email_campaigns
      SET status = 'paused', updated_at = now()
      WHERE clinic_id = NEW.clinic_id AND status IN ('running','sending','scheduled');
    INSERT INTO public.email_health_alerts (clinic_id, alert_type, metric_value, threshold, sample_size, action_taken)
      VALUES (NEW.clinic_id, 'complaint_rate', complaint_rate, 0.003, total, 'campaigns paused');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS email_logs_bounce_health_trigger ON public.email_logs;
CREATE TRIGGER email_logs_bounce_health_trigger
  AFTER UPDATE OF status ON public.email_logs
  FOR EACH ROW
  WHEN (NEW.status IN ('bounced','complained'))
  EXECUTE FUNCTION public.check_clinic_bounce_health();

CREATE OR REPLACE FUNCTION public.touch_email_domain_warmup()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS touch_email_domain_warmup_trg ON public.email_domain_warmup;
CREATE TRIGGER touch_email_domain_warmup_trg
  BEFORE UPDATE ON public.email_domain_warmup
  FOR EACH ROW EXECUTE FUNCTION public.touch_email_domain_warmup();

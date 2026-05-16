
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS test_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS email_logs_template_sent_idx
  ON public.email_logs (clinic_id, template_slug, sent_at DESC);

CREATE INDEX IF NOT EXISTS email_logs_related_idx
  ON public.email_logs (clinic_id, related_lead_table, sent_at DESC);

CREATE OR REPLACE FUNCTION public.report_template_stats(
  _clinic_id UUID,
  _template_slug TEXT,
  _from TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
  _to TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE (
  sent BIGINT, delivered BIGINT, opened BIGINT, clicked BIGINT,
  bounced BIGINT, complained BIGINT, failed BIGINT,
  open_rate NUMERIC, click_rate NUMERIC, bounce_rate NUMERIC,
  best_hour INT, hourly JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_clinic_access(_clinic_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT * FROM public.email_logs
    WHERE clinic_id = _clinic_id
      AND template_slug = _template_slug
      AND sent_at BETWEEN _from AND _to
  ),
  agg AS (
    SELECT
      COUNT(*)::BIGINT AS sent,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::BIGINT AS delivered,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::BIGINT AS opened,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::BIGINT AS clicked,
      COUNT(*) FILTER (WHERE bounced_at IS NOT NULL)::BIGINT AS bounced,
      COUNT(*) FILTER (WHERE complained_at IS NOT NULL)::BIGINT AS complained,
      COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS failed
    FROM base
  ),
  hourly_data AS (
    SELECT EXTRACT(HOUR FROM sent_at AT TIME ZONE 'America/Sao_Paulo')::INT AS h,
           COUNT(*) AS s,
           COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS o
    FROM base
    GROUP BY 1
  ),
  best AS (
    SELECT h FROM hourly_data WHERE s > 0
    ORDER BY (o::NUMERIC / NULLIF(s, 0)) DESC NULLS LAST, s DESC LIMIT 1
  ),
  hourly_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', h, 'sent', s, 'opened', o) ORDER BY h), '[]'::jsonb) AS j
    FROM hourly_data
  )
  SELECT
    a.sent, a.delivered, a.opened, a.clicked, a.bounced, a.complained, a.failed,
    CASE WHEN a.sent > 0 THEN ROUND(a.opened::NUMERIC * 100 / a.sent, 2) ELSE 0 END,
    CASE WHEN a.sent > 0 THEN ROUND(a.clicked::NUMERIC * 100 / a.sent, 2) ELSE 0 END,
    CASE WHEN a.sent > 0 THEN ROUND(a.bounced::NUMERIC * 100 / a.sent, 2) ELSE 0 END,
    (SELECT h FROM best),
    (SELECT j FROM hourly_json)
  FROM agg a;
END $$;

CREATE OR REPLACE FUNCTION public.report_campaign_stats(
  _clinic_id UUID,
  _campaign_id UUID
) RETURNS TABLE (
  sent BIGINT, delivered BIGINT, opened BIGINT, clicked BIGINT,
  bounced BIGINT, complained BIGINT, failed BIGINT,
  open_rate NUMERIC, click_rate NUMERIC, bounce_rate NUMERIC,
  best_hour INT, hourly JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _ctx TEXT := 'campaign_' || _campaign_id::text;
BEGIN
  IF NOT public.has_clinic_access(_clinic_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT * FROM public.email_logs
    WHERE clinic_id = _clinic_id AND related_lead_table = _ctx
  ),
  agg AS (
    SELECT
      COUNT(*)::BIGINT AS sent,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::BIGINT AS delivered,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::BIGINT AS opened,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::BIGINT AS clicked,
      COUNT(*) FILTER (WHERE bounced_at IS NOT NULL)::BIGINT AS bounced,
      COUNT(*) FILTER (WHERE complained_at IS NOT NULL)::BIGINT AS complained,
      COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS failed
    FROM base
  ),
  hourly_data AS (
    SELECT EXTRACT(HOUR FROM sent_at AT TIME ZONE 'America/Sao_Paulo')::INT AS h,
           COUNT(*) AS s,
           COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS o
    FROM base
    GROUP BY 1
  ),
  best AS (
    SELECT h FROM hourly_data WHERE s > 0
    ORDER BY (o::NUMERIC / NULLIF(s, 0)) DESC NULLS LAST, s DESC LIMIT 1
  ),
  hourly_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', h, 'sent', s, 'opened', o) ORDER BY h), '[]'::jsonb) AS j
    FROM hourly_data
  )
  SELECT
    a.sent, a.delivered, a.opened, a.clicked, a.bounced, a.complained, a.failed,
    CASE WHEN a.sent > 0 THEN ROUND(a.opened::NUMERIC * 100 / a.sent, 2) ELSE 0 END,
    CASE WHEN a.sent > 0 THEN ROUND(a.clicked::NUMERIC * 100 / a.sent, 2) ELSE 0 END,
    CASE WHEN a.sent > 0 THEN ROUND(a.bounced::NUMERIC * 100 / a.sent, 2) ELSE 0 END,
    (SELECT h FROM best),
    (SELECT j FROM hourly_json)
  FROM agg a;
END $$;

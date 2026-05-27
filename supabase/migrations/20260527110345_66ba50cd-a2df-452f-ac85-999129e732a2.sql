
CREATE OR REPLACE FUNCTION public.report_campaign_stats(_clinic_id uuid, _campaign_id uuid)
 RETURNS TABLE(sent bigint, delivered bigint, opened bigint, clicked bigint, bounced bigint, complained bigint, failed bigint, open_rate numeric, click_rate numeric, bounce_rate numeric, best_hour integer, hourly jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      COUNT(*) FILTER (
        WHERE bounced_at IS NULL AND status <> 'failed'
      )::BIGINT AS delivered,
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
    CASE WHEN a.delivered > 0 THEN ROUND((a.opened::NUMERIC / a.delivered) * 100, 2) ELSE 0 END AS open_rate,
    CASE WHEN a.delivered > 0 THEN ROUND((a.clicked::NUMERIC / a.delivered) * 100, 2) ELSE 0 END AS click_rate,
    CASE WHEN a.sent > 0 THEN ROUND((a.bounced::NUMERIC / a.sent) * 100, 2) ELSE 0 END AS bounce_rate,
    (SELECT h FROM best) AS best_hour,
    (SELECT j FROM hourly_json) AS hourly
  FROM agg a;
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_template_stats(_clinic_id uuid, _template_slug text, _from timestamp with time zone DEFAULT (now() - '30 days'::interval), _to timestamp with time zone DEFAULT now())
 RETURNS TABLE(sent bigint, delivered bigint, opened bigint, clicked bigint, bounced bigint, complained bigint, failed bigint, open_rate numeric, click_rate numeric, bounce_rate numeric, best_hour integer, hourly jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      COUNT(*) FILTER (
        WHERE bounced_at IS NULL AND status <> 'failed'
      )::BIGINT AS delivered,
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
    CASE WHEN a.delivered > 0 THEN ROUND((a.opened::NUMERIC / a.delivered) * 100, 2) ELSE 0 END AS open_rate,
    CASE WHEN a.delivered > 0 THEN ROUND((a.clicked::NUMERIC / a.delivered) * 100, 2) ELSE 0 END AS click_rate,
    CASE WHEN a.sent > 0 THEN ROUND((a.bounced::NUMERIC / a.sent) * 100, 2) ELSE 0 END AS bounce_rate,
    (SELECT h FROM best) AS best_hour,
    (SELECT j FROM hourly_json) AS hourly
  FROM agg a;
END;
$function$;

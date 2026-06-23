CREATE OR REPLACE VIEW public.v_pipeline_auto_retry_daily AS
SELECT
  (date_trunc('day', finished_at))::date AS day,
  count(*) FILTER (WHERE auto_retry_count > 0) AS retried_total,
  count(*) FILTER (WHERE auto_retry_count > 0 AND status = 'ok') AS retried_ok,
  count(*) FILTER (WHERE auto_retry_count >= 2 AND status = 'error') AS exhausted,
  round(
    100.0 * count(*) FILTER (WHERE auto_retry_count > 0 AND status = 'ok')::numeric
    / NULLIF(count(*) FILTER (WHERE auto_retry_count > 0), 0), 1
  ) AS recovery_pct
FROM public.pipeline_run_items
WHERE finished_at IS NOT NULL
  AND finished_at > now() - interval '30 days'
  AND is_super_admin()
GROUP BY 1
ORDER BY 1 DESC;

GRANT SELECT ON public.v_pipeline_auto_retry_daily TO authenticated;
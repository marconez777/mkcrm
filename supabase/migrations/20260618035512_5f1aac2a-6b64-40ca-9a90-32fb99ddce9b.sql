
-- 1) Destrava o run atual e quaisquer outros stale
UPDATE public.pipeline_runs
SET status = 'error',
    finished_at = COALESCE(finished_at, now()),
    totals = COALESCE(totals, '{}'::jsonb) || jsonb_build_object('error', 'worker_timeout_no_heartbeat')
WHERE status IN ('queued', 'running')
  AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - interval '2 minutes')
  AND started_at < now() - interval '2 minutes';

UPDATE public.pipeline_run_items
SET status = 'error',
    error = COALESCE(error, 'worker_timeout_no_heartbeat'),
    finished_at = COALESCE(finished_at, now())
WHERE status = 'pending'
  AND run_id IN (SELECT id FROM public.pipeline_runs WHERE status = 'error');

-- 2) Watchdog function (SECURITY DEFINER) — pode ser chamado por edge functions / cron
CREATE OR REPLACE FUNCTION public.mark_stale_pipeline_runs_as_error()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH stale AS (
    UPDATE public.pipeline_runs
    SET status = 'error',
        finished_at = COALESCE(finished_at, now()),
        totals = COALESCE(totals, '{}'::jsonb) || jsonb_build_object('error', 'worker_timeout_no_heartbeat')
    WHERE status IN ('queued', 'running')
      AND (
        (last_heartbeat_at IS NOT NULL AND last_heartbeat_at < now() - interval '3 minutes')
        OR (last_heartbeat_at IS NULL AND started_at IS NOT NULL AND started_at < now() - interval '3 minutes')
      )
    RETURNING id
  )
  SELECT count(*) INTO updated_count FROM stale;

  UPDATE public.pipeline_run_items
  SET status = 'error',
      error = COALESCE(error, 'worker_timeout_no_heartbeat'),
      finished_at = COALESCE(finished_at, now())
  WHERE status = 'pending'
    AND run_id IN (
      SELECT id FROM public.pipeline_runs
      WHERE status = 'error' AND finished_at > now() - interval '10 seconds'
    );

  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_stale_pipeline_runs_as_error() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_stale_pipeline_runs_as_error() TO service_role, authenticated;

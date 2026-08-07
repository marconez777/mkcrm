
-- 1) Revoke column-level SELECT on sensitive WhatsApp credentials
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM authenticated;
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM anon;

-- 2) TTL cleanup for stale AI agent drafts (older than 7 days) to ensure plaintext
--    provider api_keys aren't kept indefinitely if the wizard is abandoned.
CREATE OR REPLACE FUNCTION public.cleanup_stale_ai_agent_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.ai_agent_drafts
  WHERE updated_at < now() - interval '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_ai_agent_drafts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_ai_agent_drafts() TO service_role;

-- Schedule daily via pg_cron (idempotent: unschedule any prior copy first)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-stale-ai-agent-drafts');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'cleanup-stale-ai-agent-drafts',
  '0 3 * * *',
  $$SELECT public.cleanup_stale_ai_agent_drafts();$$
);

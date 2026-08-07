
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS evolution_api_key_set boolean
    GENERATED ALWAYS AS (evolution_api_key IS NOT NULL AND length(evolution_api_key) > 0) STORED,
  ADD COLUMN IF NOT EXISTS webhook_token_set boolean
    GENERATED ALWAYS AS (webhook_token IS NOT NULL AND length(webhook_token) > 0) STORED;

REVOKE SELECT ON public.whatsapp_instances FROM authenticated, anon;

GRANT SELECT (
  id, name, evolution_url, evolution_instance, connection_state,
  last_health_check, webhook_ok, webhook_last_error, webhook_last_set_at,
  last_poll_at, is_default, created_at, updated_at, clinic_id,
  watcher_agent_id, watcher_pipeline_id, last_inbound_webhook_at,
  last_auto_restart_at, auto_restart_count, last_reconnect_at,
  last_backfill_at, last_backfill_imported, session_stale_since,
  last_auto_logout_at, auto_logout_count,
  evolution_api_key_set, webhook_token_set
) ON public.whatsapp_instances TO authenticated;

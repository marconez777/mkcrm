
-- Restrict SELECT on sensitive columns by revoking table-wide SELECT
-- from authenticated and re-granting only safe columns.

-- ai_agents: exclude api_key, embedding_api_key, reranker_api_key
REVOKE SELECT ON public.ai_agents FROM authenticated;
GRANT SELECT (
  id, name, description, system_prompt, model, temperature, enabled, tools,
  created_at, updated_at, provider, base_url, embedding_model,
  reranker_provider, max_iterations, use_hyde, use_hybrid_search, use_memory,
  planning_mode, rag_top_k, debounce_seconds, max_tool_calls, clinic_id,
  silent, role, is_system, system_key, builder_verified_at, draft_mode,
  niche, niche_other, stages_enabled,
  api_key_set, embedding_api_key_set, reranker_api_key_set
) ON public.ai_agents TO authenticated;

-- whatsapp_instances: exclude evolution_api_key, webhook_token
REVOKE SELECT ON public.whatsapp_instances FROM authenticated;
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

-- clinic_invites: exclude token (only service_role/edge functions handle raw token)
REVOKE SELECT ON public.clinic_invites FROM authenticated;
GRANT SELECT (
  id, clinic_id, email, role, invited_by, expires_at, accepted_at, created_at
) ON public.clinic_invites TO authenticated;

-- form_submissions: exclude ip, user_agent (LGPD/GDPR PII)
REVOKE SELECT ON public.form_submissions FROM authenticated;
GRANT SELECT (
  id, clinic_id, integration_id, form_definition_id, form_key, source_page,
  payload, lead_id, is_new_lead, status, error, created_at
) ON public.form_submissions TO authenticated;

-- message_sequences: exclude public_token
REVOKE SELECT ON public.message_sequences FROM authenticated;
GRANT SELECT (
  id, clinic_id, name, description, enabled, trigger_type, trigger_config,
  whatsapp_instance_id, stop_on_reply, cooldown_days, created_at, updated_at
) ON public.message_sequences TO authenticated;

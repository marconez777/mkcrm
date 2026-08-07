
-- ai_agent_drafts: revoke table SELECT and re-grant only non-secret columns
REVOKE SELECT ON public.ai_agent_drafts FROM authenticated, anon;
GRANT SELECT (
  id, clinic_id, user_id, step, niche, niche_other, goal, goal_other,
  provider, base_url, model, provider_verified_at, interview_answers,
  generated_prompt, settings, created_at, updated_at
) ON public.ai_agent_drafts TO authenticated;

-- support_agent_config: add generated indicator column, then revoke table SELECT
ALTER TABLE public.support_agent_config
  ADD COLUMN IF NOT EXISTS api_key_set boolean
  GENERATED ALWAYS AS (api_key IS NOT NULL AND length(api_key) > 0) STORED;

REVOKE SELECT ON public.support_agent_config FROM authenticated, anon;
GRANT SELECT (
  id, singleton, provider, model, embedding_model, temperature, max_iterations,
  system_prompt, enabled, monthly_cap_usd, kb_synced_at, updated_by,
  created_at, updated_at, api_key_set
) ON public.support_agent_config TO authenticated;

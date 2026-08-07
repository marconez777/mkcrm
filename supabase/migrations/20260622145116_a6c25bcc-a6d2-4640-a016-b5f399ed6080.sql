
-- 1) Generated indicators
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS api_key_set boolean
    GENERATED ALWAYS AS (api_key IS NOT NULL AND length(api_key) > 0) STORED,
  ADD COLUMN IF NOT EXISTS embedding_api_key_set boolean
    GENERATED ALWAYS AS (embedding_api_key IS NOT NULL AND length(embedding_api_key) > 0) STORED,
  ADD COLUMN IF NOT EXISTS reranker_api_key_set boolean
    GENERATED ALWAYS AS (reranker_api_key IS NOT NULL AND length(reranker_api_key) > 0) STORED;

-- 2) Revoke table SELECT and re-grant only non-secret columns + indicators
REVOKE SELECT ON public.ai_agents FROM authenticated, anon;

GRANT SELECT (
  id, name, description, system_prompt, model, temperature, enabled, tools,
  created_at, updated_at, provider, base_url, embedding_model,
  reranker_provider, max_iterations, use_hyde, use_hybrid_search, use_memory,
  planning_mode, rag_top_k, debounce_seconds, max_tool_calls, clinic_id,
  silent, role, is_system, system_key, builder_verified_at, draft_mode,
  niche, niche_other, stages_enabled,
  api_key_set, embedding_api_key_set, reranker_api_key_set
) ON public.ai_agents TO authenticated;

-- 3) Recreate admin RPCs without raw API keys
DROP FUNCTION IF EXISTS public.admin_list_ai_agents();
CREATE FUNCTION public.admin_list_ai_agents()
RETURNS TABLE (
  id uuid, name text, description text, system_prompt text, model text,
  temperature numeric, enabled boolean, tools jsonb,
  created_at timestamptz, updated_at timestamptz,
  provider text, base_url text, embedding_model text,
  reranker_provider text, max_iterations integer, use_hyde boolean,
  use_hybrid_search boolean, use_memory boolean, planning_mode boolean,
  rag_top_k integer, debounce_seconds integer, max_tool_calls integer,
  clinic_id uuid, silent boolean, role text, is_system boolean,
  system_key text, builder_verified_at timestamptz, draft_mode boolean,
  niche text, niche_other text, stages_enabled boolean,
  api_key_set boolean, embedding_api_key_set boolean, reranker_api_key_set boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_clinic_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT a.id, a.name, a.description, a.system_prompt, a.model,
           a.temperature, a.enabled, a.tools,
           a.created_at, a.updated_at,
           a.provider, a.base_url, a.embedding_model,
           a.reranker_provider, a.max_iterations, a.use_hyde,
           a.use_hybrid_search, a.use_memory, a.planning_mode,
           a.rag_top_k, a.debounce_seconds, a.max_tool_calls,
           a.clinic_id, a.silent, a.role, a.is_system,
           a.system_key, a.builder_verified_at, a.draft_mode,
           a.niche, a.niche_other, a.stages_enabled,
           a.api_key_set, a.embedding_api_key_set, a.reranker_api_key_set
    FROM public.ai_agents a
    WHERE a.clinic_id = public.current_clinic_id()
    ORDER BY a.created_at;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_get_ai_agent(uuid);
CREATE FUNCTION public.admin_get_ai_agent(_id uuid)
RETURNS TABLE (
  id uuid, name text, description text, system_prompt text, model text,
  temperature numeric, enabled boolean, tools jsonb,
  created_at timestamptz, updated_at timestamptz,
  provider text, base_url text, embedding_model text,
  reranker_provider text, max_iterations integer, use_hyde boolean,
  use_hybrid_search boolean, use_memory boolean, planning_mode boolean,
  rag_top_k integer, debounce_seconds integer, max_tool_calls integer,
  clinic_id uuid, silent boolean, role text, is_system boolean,
  system_key text, builder_verified_at timestamptz, draft_mode boolean,
  niche text, niche_other text, stages_enabled boolean,
  api_key_set boolean, embedding_api_key_set boolean, reranker_api_key_set boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_clinic_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT a.id, a.name, a.description, a.system_prompt, a.model,
           a.temperature, a.enabled, a.tools,
           a.created_at, a.updated_at,
           a.provider, a.base_url, a.embedding_model,
           a.reranker_provider, a.max_iterations, a.use_hyde,
           a.use_hybrid_search, a.use_memory, a.planning_mode,
           a.rag_top_k, a.debounce_seconds, a.max_tool_calls,
           a.clinic_id, a.silent, a.role, a.is_system,
           a.system_key, a.builder_verified_at, a.draft_mode,
           a.niche, a.niche_other, a.stages_enabled,
           a.api_key_set, a.embedding_api_key_set, a.reranker_api_key_set
    FROM public.ai_agents a
    WHERE a.id = _id AND a.clinic_id = public.current_clinic_id();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_ai_agents() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_ai_agent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_ai_agents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_agent(uuid) TO authenticated;

-- 4) get_builder_agent_for_clinic now returns api_key_set instead of api_key
DROP FUNCTION IF EXISTS public.get_builder_agent_for_clinic(uuid);
CREATE FUNCTION public.get_builder_agent_for_clinic(_clinic_id uuid)
RETURNS TABLE (
  id uuid,
  provider text,
  model text,
  api_key_set boolean,
  base_url text,
  builder_verified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.provider, a.model,
         (a.api_key IS NOT NULL AND length(a.api_key) > 0) AS api_key_set,
         a.base_url, a.builder_verified_at
  FROM public.ai_agents a
  WHERE a.clinic_id = _clinic_id
    AND a.system_key = 'builder'
    AND has_clinic_access(a.clinic_id)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_builder_agent_for_clinic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_builder_agent_for_clinic(uuid) TO authenticated, service_role;


-- 1) ai_agents: revoke secret columns from client roles
REVOKE SELECT (api_key, embedding_api_key, reranker_api_key) ON public.ai_agents FROM authenticated;
REVOKE SELECT (api_key, embedding_api_key, reranker_api_key) ON public.ai_agents FROM anon;

-- 2) agent_mcp_servers: revoke headers (may contain auth tokens) from client roles
REVOKE SELECT (headers) ON public.agent_mcp_servers FROM authenticated;
REVOKE SELECT (headers) ON public.agent_mcp_servers FROM anon;

-- 3) whatsapp_instances: revoke evolution_api_key + webhook_token from client roles
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM authenticated;
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM anon;

-- 4) embedding_cache: drop the "true" SELECT policy. Only service_role (edge functions) reads/writes it.
DROP POLICY IF EXISTS embedding_cache_read_authenticated ON public.embedding_cache;

-- 5) Admin-only RPCs that expose the sensitive columns (used by the Agents admin page).
CREATE OR REPLACE FUNCTION public.admin_list_ai_agents()
RETURNS SETOF public.ai_agents
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
    SELECT * FROM public.ai_agents
    WHERE clinic_id = public.current_clinic_id()
    ORDER BY created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_ai_agent(_id uuid)
RETURNS SETOF public.ai_agents
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
    SELECT * FROM public.ai_agents
    WHERE id = _id AND clinic_id = public.current_clinic_id();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_agent_mcp_servers(_agent_id uuid)
RETURNS SETOF public.agent_mcp_servers
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
    SELECT * FROM public.agent_mcp_servers
    WHERE agent_id = _agent_id AND clinic_id = public.current_clinic_id()
    ORDER BY created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_ai_agents() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_ai_agent(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_agent_mcp_servers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_ai_agents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_agent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_agent_mcp_servers(uuid) TO authenticated;

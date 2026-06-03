
-- 1) ai_agent_drafts: SELECT only own drafts
DROP POLICY IF EXISTS "Users see drafts in their clinic" ON public.ai_agent_drafts;
CREATE POLICY "Users see their own drafts"
  ON public.ai_agent_drafts FOR SELECT
  USING (user_id = auth.uid());

-- 2) ai_agents: revoke SELECT on sensitive credential columns
REVOKE SELECT (api_key, embedding_api_key, reranker_api_key)
  ON public.ai_agents FROM authenticated, anon;

-- 3) whatsapp_instances: revoke SELECT on credential columns
REVOKE SELECT (evolution_api_key, webhook_token)
  ON public.whatsapp_instances FROM authenticated, anon;

-- 4) agent_mcp_servers: revoke SELECT on auth headers
REVOKE SELECT (headers)
  ON public.agent_mcp_servers FROM authenticated, anon;

-- 5) error_events: restrict insert to authenticated users (was USING true)
DROP POLICY IF EXISTS error_events_insert ON public.error_events;
CREATE POLICY error_events_insert
  ON public.error_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

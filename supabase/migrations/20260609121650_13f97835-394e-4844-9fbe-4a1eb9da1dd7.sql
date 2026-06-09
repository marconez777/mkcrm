
-- Column-level REVOKEs for sensitive credentials
REVOKE SELECT (headers) ON public.agent_mcp_servers FROM authenticated, anon;
REVOKE SELECT (api_key) ON public.ai_agent_drafts FROM authenticated, anon;
REVOKE SELECT (api_key, embedding_api_key, reranker_api_key) ON public.ai_agents FROM authenticated, anon;
REVOKE SELECT (token, previous_token) ON public.form_integrations FROM authenticated, anon;
REVOKE SELECT (api_key) ON public.support_agent_config FROM authenticated, anon;
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM authenticated, anon;

-- Restrict policies to authenticated role only
DROP POLICY IF EXISTS agent_personas_admin_write ON public.agent_personas;
CREATE POLICY agent_personas_admin_write ON public.agent_personas
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((clinic_id = current_clinic_id()) AND is_clinic_admin() AND current_clinic_has_feature('agents'::text))
  WITH CHECK ((clinic_id = current_clinic_id()) AND is_clinic_admin() AND current_clinic_has_feature('agents'::text));

DROP POLICY IF EXISTS agent_personas_select ON public.agent_personas;
CREATE POLICY agent_personas_select ON public.agent_personas
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((clinic_id = current_clinic_id()) AND current_clinic_has_feature('agents'::text));

DROP POLICY IF EXISTS agent_stages_admin_write ON public.agent_stages;
CREATE POLICY agent_stages_admin_write ON public.agent_stages
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((clinic_id = current_clinic_id()) AND is_clinic_admin() AND current_clinic_has_feature('agents'::text))
  WITH CHECK ((clinic_id = current_clinic_id()) AND is_clinic_admin() AND current_clinic_has_feature('agents'::text));

DROP POLICY IF EXISTS agent_stages_select ON public.agent_stages;
CREATE POLICY agent_stages_select ON public.agent_stages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((clinic_id = current_clinic_id()) AND current_clinic_has_feature('agents'::text));

DROP POLICY IF EXISTS "Users see their own drafts" ON public.ai_agent_drafts;
CREATE POLICY "Users see their own drafts" ON public.ai_agent_drafts
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_chat_traces_select ON public.ai_chat_traces;
CREATE POLICY ai_chat_traces_select ON public.ai_chat_traces
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((clinic_id = current_clinic_id()) AND current_clinic_has_feature('agents'::text));

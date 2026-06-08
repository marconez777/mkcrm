
-- 1. agent_mcp_servers: restrict writes to admins; revoke SELECT on headers (credentials)
DROP POLICY IF EXISTS "clinic_scoped" ON public.agent_mcp_servers;

CREATE POLICY "agent_mcp_servers_select" ON public.agent_mcp_servers
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

CREATE POLICY "agent_mcp_servers_admin_write" ON public.agent_mcp_servers
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

CREATE POLICY "agent_mcp_servers_admin_update" ON public.agent_mcp_servers
  FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

CREATE POLICY "agent_mcp_servers_admin_delete" ON public.agent_mcp_servers
  FOR DELETE TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

REVOKE SELECT (headers) ON public.agent_mcp_servers FROM authenticated, anon;

-- 2. ai_agent_drafts: revoke SELECT on api_key column
REVOKE SELECT (api_key) ON public.ai_agent_drafts FROM authenticated, anon;

-- 3. email_operational_alerts: super-admin can see system-wide alerts (clinic_id IS NULL)
CREATE POLICY "email_operational_alerts_super_admin_read" ON public.email_operational_alerts
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- 4. rag_cache: explicit super-admin read; writes only via service_role (default deny)
CREATE POLICY "rag_cache_super_admin_read" ON public.rag_cache
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- 5. resend_webhook_events: explicit super-admin read; service_role only writes
CREATE POLICY "resend_webhook_events_super_admin_read" ON public.resend_webhook_events
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- 6. webhook_dedup: explicit super-admin read; service_role only writes
CREATE POLICY "webhook_dedup_super_admin_read" ON public.webhook_dedup
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- 7. email_recipient_throttle: explicit super-admin read; service_role only writes
CREATE POLICY "email_recipient_throttle_super_admin_read" ON public.email_recipient_throttle
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

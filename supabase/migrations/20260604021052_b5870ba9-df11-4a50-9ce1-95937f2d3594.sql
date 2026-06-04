
-- 1) agent_mcp_servers.headers — revoke SELECT from client roles
REVOKE SELECT (headers) ON public.agent_mcp_servers FROM authenticated;
REVOKE SELECT (headers) ON public.agent_mcp_servers FROM anon;

-- 2) whatsapp_instances credentials — idempotent re-revoke
REVOKE SELECT (evolution_api_key) ON public.whatsapp_instances FROM authenticated;
REVOKE SELECT (evolution_api_key) ON public.whatsapp_instances FROM anon;
REVOKE SELECT (webhook_token)     ON public.whatsapp_instances FROM authenticated;
REVOKE SELECT (webhook_token)     ON public.whatsapp_instances FROM anon;

-- 3) email_queue — split policy: members can SELECT, only admins can write
DROP POLICY IF EXISTS email_queue_clinic ON public.email_queue;

CREATE POLICY email_queue_select ON public.email_queue
  FOR SELECT TO authenticated
  USING (
    has_clinic_access(clinic_id)
    AND clinic_has_feature(clinic_id, 'email_marketing')
  );

CREATE POLICY email_queue_admin_insert ON public.email_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    has_clinic_access(clinic_id)
    AND is_clinic_admin(clinic_id)
    AND clinic_has_feature(clinic_id, 'email_marketing')
  );

CREATE POLICY email_queue_admin_update ON public.email_queue
  FOR UPDATE TO authenticated
  USING (
    has_clinic_access(clinic_id)
    AND is_clinic_admin(clinic_id)
    AND clinic_has_feature(clinic_id, 'email_marketing')
  )
  WITH CHECK (
    has_clinic_access(clinic_id)
    AND is_clinic_admin(clinic_id)
    AND clinic_has_feature(clinic_id, 'email_marketing')
  );

CREATE POLICY email_queue_admin_delete ON public.email_queue
  FOR DELETE TO authenticated
  USING (
    has_clinic_access(clinic_id)
    AND is_clinic_admin(clinic_id)
    AND clinic_has_feature(clinic_id, 'email_marketing')
  );

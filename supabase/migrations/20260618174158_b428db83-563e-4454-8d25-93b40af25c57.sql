-- 1) ai_agents: hide sensitive key columns from authenticated reads (service_role still has access)
REVOKE SELECT (api_key, embedding_api_key, reranker_api_key) ON public.ai_agents FROM authenticated;
REVOKE SELECT (api_key, embedding_api_key, reranker_api_key) ON public.ai_agents FROM anon;

-- 2) whatsapp_instances: hide credential columns from authenticated reads
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM authenticated;
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM anon;

-- 3) email_logs: restrict SELECT to clinic admins (was: all clinic members with email_marketing feature)
DROP POLICY IF EXISTS email_logs_read ON public.email_logs;
CREATE POLICY email_logs_admin_read ON public.email_logs
  FOR SELECT TO authenticated
  USING (
    has_clinic_access(clinic_id)
    AND is_clinic_admin(clinic_id)
    AND clinic_has_feature(clinic_id, 'email_marketing')
  );

-- 4) email_queue: restrict SELECT to clinic admins (write was already admin-only)
DROP POLICY IF EXISTS email_queue_select ON public.email_queue;
CREATE POLICY email_queue_admin_select ON public.email_queue
  FOR SELECT TO authenticated
  USING (
    has_clinic_access(clinic_id)
    AND is_clinic_admin(clinic_id)
    AND clinic_has_feature(clinic_id, 'email_marketing')
  );
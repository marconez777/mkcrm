
-- 1) ai_agents: revoke API key columns from authenticated
REVOKE SELECT (api_key, embedding_api_key, reranker_api_key) ON public.ai_agents FROM authenticated;

-- 2) whatsapp_instances: revoke evolution_api_key and webhook_token
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM authenticated;

-- 3) clinic_secrets: revoke all access from authenticated/anon (only service_role reads)
REVOKE ALL ON public.clinic_secrets FROM authenticated;
REVOKE ALL ON public.clinic_secrets FROM anon;
GRANT ALL ON public.clinic_secrets TO service_role;

-- 4) form_integrations: revoke token columns from authenticated
REVOKE SELECT (token, previous_token) ON public.form_integrations FROM authenticated;

-- 5) support_agent_config: defense-in-depth revoke api_key column
REVOKE SELECT (api_key) ON public.support_agent_config FROM authenticated;

-- 6) deleted_leads: restrict to clinic admins only
DROP POLICY IF EXISTS deleted_leads_clinic_scoped ON public.deleted_leads;
CREATE POLICY deleted_leads_admin_read ON public.deleted_leads
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());
CREATE POLICY deleted_leads_admin_write ON public.deleted_leads
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- 7) email_logs: block direct writes by authenticated (only service_role can write)
REVOKE INSERT, UPDATE, DELETE ON public.email_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.email_logs FROM anon;

-- 8) current_clinic_id(): honor x-clinic-id header for multi-clinic users; fail closed if ambiguous
CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_header_clinic uuid;
  v_count int;
  v_only_clinic uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Try header x-clinic-id (set by app for active clinic context)
  BEGIN
    v_header_clinic := NULLIF(
      (current_setting('request.headers', true)::jsonb ->> 'x-clinic-id'),
      ''
    )::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_header_clinic := NULL;
  END;

  IF v_header_clinic IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.clinic_members
      WHERE user_id = v_uid AND clinic_id = v_header_clinic
    ) THEN
      RETURN v_header_clinic;
    ELSE
      RETURN NULL;  -- header given but user is not a member
    END IF;
  END IF;

  -- No header: only return a clinic if the user belongs to exactly one
  SELECT count(*), min(clinic_id) INTO v_count, v_only_clinic
  FROM public.clinic_members
  WHERE user_id = v_uid;

  IF v_count = 1 THEN
    RETURN v_only_clinic;
  END IF;

  -- Multiple memberships and no header → fail closed
  RETURN NULL;
END;
$function$;

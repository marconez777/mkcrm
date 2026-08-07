
-- 1) Restore current_clinic_id() fail-open behavior (header optional)
CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_header_clinic uuid;
  v_result uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Optional header for multi-clinic users to pick active clinic
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
      RETURN NULL;
    END IF;
  END IF;

  -- Default: oldest membership (matches original behavior)
  SELECT clinic_id INTO v_result
  FROM public.clinic_members
  WHERE user_id = v_uid
  ORDER BY created_at ASC, clinic_id ASC
  LIMIT 1;

  RETURN v_result;
END;
$function$;

-- 2) Re-grant table-level SELECT (Realtime + PostgREST need it),
--    keeping column-level revokes for sensitive credentials.

-- ai_agents
GRANT SELECT ON public.ai_agents TO authenticated;
REVOKE SELECT (api_key, embedding_api_key, reranker_api_key)
  ON public.ai_agents FROM authenticated, anon;

-- whatsapp_instances
GRANT SELECT ON public.whatsapp_instances TO authenticated;
REVOKE SELECT (evolution_api_key, webhook_token)
  ON public.whatsapp_instances FROM authenticated, anon;

-- form_integrations
GRANT SELECT ON public.form_integrations TO authenticated;
REVOKE SELECT (token, previous_token)
  ON public.form_integrations FROM authenticated, anon;

-- ai_agent_drafts
GRANT SELECT ON public.ai_agent_drafts TO authenticated;
REVOKE SELECT (api_key)
  ON public.ai_agent_drafts FROM authenticated, anon;

-- support_agent_config
GRANT SELECT ON public.support_agent_config TO authenticated;
REVOKE SELECT (api_key)
  ON public.support_agent_config FROM authenticated, anon;

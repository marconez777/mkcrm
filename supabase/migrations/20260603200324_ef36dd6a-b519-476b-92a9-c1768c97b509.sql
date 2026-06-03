CREATE OR REPLACE FUNCTION public.admin_clinic_usage(_clinic uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'members', (SELECT count(*) FROM public.clinic_members WHERE clinic_id = _clinic),
    'leads_total', (SELECT count(*) FROM public.leads WHERE clinic_id = _clinic),
    'messages_30d', (SELECT count(*) FROM public.messages WHERE clinic_id = _clinic AND created_at >= now() - interval '30 days'),
    'messages_month', (SELECT count(*) FROM public.messages WHERE clinic_id = _clinic AND from_me = true AND created_at >= date_trunc('month', now())),
    'emails_month', (SELECT count(*) FROM public.email_logs WHERE clinic_id = _clinic AND created_at >= date_trunc('month', now())),
    'ai_usd_month', (SELECT COALESCE(sum(cost_usd),0) FROM public.ai_usage WHERE clinic_id = _clinic AND created_at >= date_trunc('month', now())),
    'whatsapp_instances', (SELECT count(*) FROM public.whatsapp_instances WHERE clinic_id = _clinic),
    'email_domains', (SELECT count(*) FROM public.email_domains WHERE clinic_id = _clinic),
    'ai_agents', (SELECT count(*) FROM public.ai_agents WHERE clinic_id = _clinic),
    'kb_documents', (SELECT count(*) FROM public.ai_documents WHERE clinic_id = _clinic),
    'broadcasts_month', (SELECT count(*) FROM public.broadcasts WHERE clinic_id = _clinic AND created_at >= date_trunc('month', now()))
  ) INTO result;
  RETURN result;
END $function$;
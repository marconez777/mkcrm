
-- 1) plans catalog
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price_monthly_brl numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly_brl  numeric(10,2) NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  limits   jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans readable by authenticated"
  ON public.plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "plans insert by super admin"
  ON public.plans FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "plans update by super admin"
  ON public.plans FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "plans delete by super admin"
  ON public.plans FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE TRIGGER plans_set_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.plans (code, name, description, sort_order, price_monthly_brl) VALUES
  ('free','Free','Plano gratuito de entrada',1,0),
  ('starter','Starter','Para times pequenos começando',2,99),
  ('pro','Pro','Para operações em crescimento',3,299),
  ('enterprise','Enterprise','Customizado para grandes operações',4,0)
ON CONFLICT (code) DO NOTHING;

-- 2) Admin metrics RPCs
CREATE OR REPLACE FUNCTION public.admin_overview_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'clinics', (SELECT jsonb_build_object(
      'total', count(*),
      'active', count(*) FILTER (WHERE status='active'),
      'suspended', count(*) FILTER (WHERE status='suspended'),
      'new_30d', count(*) FILTER (WHERE created_at >= now() - interval '30 days')
    ) FROM public.clinics),
    'users', (SELECT jsonb_build_object(
      'total', count(*),
      'new_30d', count(*) FILTER (WHERE created_at >= now() - interval '30 days')
    ) FROM auth.users),
    'messages_30d', (SELECT jsonb_build_object(
      'total', count(*),
      'outbound', count(*) FILTER (WHERE direction='outbound'),
      'inbound', count(*) FILTER (WHERE direction='inbound')
    ) FROM public.messages WHERE created_at >= now() - interval '30 days'),
    'ai_30d', (SELECT jsonb_build_object(
      'cost_usd', COALESCE(sum(cost_usd),0),
      'tokens', COALESCE(sum(total_tokens),0),
      'requests', count(*)
    ) FROM public.ai_usage WHERE created_at >= now() - interval '30 days'),
    'email_30d', (SELECT jsonb_build_object(
      'sent', count(*),
      'opened', count(*) FILTER (WHERE opened_at IS NOT NULL),
      'clicked', count(*) FILTER (WHERE clicked_at IS NOT NULL),
      'bounced', count(*) FILTER (WHERE bounced_at IS NOT NULL)
    ) FROM public.email_logs WHERE created_at >= now() - interval '30 days'),
    'leads_30d', (SELECT jsonb_build_object(
      'total', count(*)
    ) FROM public.leads WHERE created_at >= now() - interval '30 days')
  ) INTO result;

  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_top_clinics(_limit int DEFAULT 5)
RETURNS TABLE(clinic_id uuid, clinic_name text, messages_30d bigint, ai_cost_usd_30d numeric, leads_30d bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT c.id, c.name,
    COALESCE((SELECT count(*) FROM public.messages m WHERE m.clinic_id = c.id AND m.created_at >= now() - interval '30 days'),0)::bigint,
    COALESCE((SELECT sum(cost_usd) FROM public.ai_usage a WHERE a.clinic_id = c.id AND a.created_at >= now() - interval '30 days'),0)::numeric,
    COALESCE((SELECT count(*) FROM public.leads l WHERE l.clinic_id = c.id AND l.created_at >= now() - interval '30 days'),0)::bigint
  FROM public.clinics c
  ORDER BY 3 DESC NULLS LAST
  LIMIT _limit;
END $$;

CREATE OR REPLACE FUNCTION public.admin_clinic_usage(_clinic uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'members', (SELECT count(*) FROM public.clinic_members WHERE clinic_id = _clinic),
    'leads_total', (SELECT count(*) FROM public.leads WHERE clinic_id = _clinic),
    'messages_30d', (SELECT count(*) FROM public.messages WHERE clinic_id = _clinic AND created_at >= now() - interval '30 days'),
    'messages_month', (SELECT count(*) FROM public.messages WHERE clinic_id = _clinic AND direction='outbound' AND created_at >= date_trunc('month', now())),
    'emails_month', (SELECT count(*) FROM public.email_logs WHERE clinic_id = _clinic AND created_at >= date_trunc('month', now())),
    'ai_usd_month', (SELECT COALESCE(sum(cost_usd),0) FROM public.ai_usage WHERE clinic_id = _clinic AND created_at >= date_trunc('month', now())),
    'whatsapp_instances', (SELECT count(*) FROM public.whatsapp_instances WHERE clinic_id = _clinic),
    'email_domains', (SELECT count(*) FROM public.email_domains WHERE clinic_id = _clinic),
    'ai_agents', (SELECT count(*) FROM public.ai_agents WHERE clinic_id = _clinic),
    'kb_documents', (SELECT count(*) FROM public.ai_documents WHERE clinic_id = _clinic),
    'broadcasts_month', (SELECT count(*) FROM public.broadcasts WHERE clinic_id = _clinic AND created_at >= date_trunc('month', now()))
  ) INTO result;
  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_overview_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_top_clinics(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clinic_usage(uuid) TO authenticated;

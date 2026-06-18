CREATE OR REPLACE FUNCTION public.get_builder_agent_for_clinic(_clinic_id uuid)
RETURNS TABLE (
  id uuid,
  provider text,
  model text,
  api_key text,
  base_url text,
  builder_verified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.provider, a.model, a.api_key, a.base_url, a.builder_verified_at
  FROM public.ai_agents a
  WHERE a.clinic_id = _clinic_id
    AND a.system_key = 'builder'
    AND has_clinic_access(a.clinic_id)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_builder_agent_for_clinic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_builder_agent_for_clinic(uuid) TO authenticated, service_role;
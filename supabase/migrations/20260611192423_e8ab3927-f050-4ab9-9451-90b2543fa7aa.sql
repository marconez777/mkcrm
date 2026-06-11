
-- Remove a view problemática
DROP VIEW IF EXISTS public.clinic_openai_status;

-- Função pro frontend ler o STATUS (sem expor a chave)
CREATE OR REPLACE FUNCTION public.get_clinic_openai_status(_clinic_id uuid)
RETURNS TABLE (
  clinic_id uuid,
  openai_status text,
  openai_key_last4 text,
  openai_last_checked_at timestamptz,
  openai_last_error text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cs.clinic_id,
    cs.openai_status,
    cs.openai_key_last4,
    cs.openai_last_checked_at,
    cs.openai_last_error,
    cs.updated_at
  FROM public.clinic_secrets cs
  WHERE cs.clinic_id = _clinic_id
    AND (cs.clinic_id = public.current_clinic_id() OR public.is_super_admin())
$$;

REVOKE ALL ON FUNCTION public.get_clinic_openai_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_clinic_openai_status(uuid) TO authenticated, service_role;

-- Reforça search_path na get_openai_key (já tinha, mas garante)
CREATE OR REPLACE FUNCTION public.get_openai_key(_clinic_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT openai_api_key
  FROM public.clinic_secrets
  WHERE clinic_id = _clinic_id
$$;

REVOKE ALL ON FUNCTION public.get_openai_key(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_openai_key(uuid) TO service_role;

-- set_updated_at já existe no projeto; garantir search_path fixo se for a nova
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

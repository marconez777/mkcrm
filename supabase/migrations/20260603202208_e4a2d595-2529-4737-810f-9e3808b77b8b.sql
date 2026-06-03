CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token text)
RETURNS TABLE(clinic_id uuid, email text, role clinic_role, expires_at timestamptz, accepted_at timestamptz, clinic_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.clinic_id, i.email, i.role, i.expires_at, i.accepted_at, c.name
  FROM public.clinic_invites i
  LEFT JOIN public.clinics c ON c.id = i.clinic_id
  WHERE i.token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;
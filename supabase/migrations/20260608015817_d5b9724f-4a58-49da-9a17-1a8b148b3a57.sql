CREATE OR REPLACE FUNCTION public.admin_get_last_seen(_user_ids uuid[])
RETURNS TABLE(user_id uuid, last_seen_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT s.user_id, MAX(s.updated_at) AS last_seen_at
  FROM auth.sessions s
  WHERE s.user_id = ANY(_user_ids)
  GROUP BY s.user_id;
$$;

REVOKE ALL ON FUNCTION public.admin_get_last_seen(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_last_seen(uuid[]) TO service_role;
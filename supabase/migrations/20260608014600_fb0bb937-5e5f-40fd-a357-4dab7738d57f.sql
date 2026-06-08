-- Lock down auth_lockouts: restrict SELECT to super_admin only; writes via service_role only.
REVOKE ALL ON public.auth_lockouts FROM anon, authenticated;
GRANT SELECT ON public.auth_lockouts TO authenticated;
GRANT ALL ON public.auth_lockouts TO service_role;

DROP POLICY IF EXISTS "auth_lockouts_super_admin_read" ON public.auth_lockouts;
CREATE POLICY "auth_lockouts_super_admin_read" ON public.auth_lockouts
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
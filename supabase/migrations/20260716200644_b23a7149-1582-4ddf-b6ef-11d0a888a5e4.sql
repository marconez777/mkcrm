-- Defense-in-depth: explicitly deny all client access to clinic_secrets.
-- Table is only touched by edge functions using service_role.
REVOKE ALL ON public.clinic_secrets FROM anon, authenticated;

ALTER TABLE public.clinic_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_secrets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all client access to clinic_secrets" ON public.clinic_secrets;
CREATE POLICY "Deny all client access to clinic_secrets"
ON public.clinic_secrets
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

GRANT ALL ON public.clinic_secrets TO service_role;
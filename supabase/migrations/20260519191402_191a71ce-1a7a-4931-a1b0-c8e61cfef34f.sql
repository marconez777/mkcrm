CREATE TABLE IF NOT EXISTS public.auth_lockouts (
  email text PRIMARY KEY,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_lockouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view lockouts"
ON public.auth_lockouts FOR SELECT
USING (public.is_super_admin());

CREATE POLICY "Super admins can update lockouts"
ON public.auth_lockouts FOR UPDATE
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can delete lockouts"
ON public.auth_lockouts FOR DELETE
USING (public.is_super_admin());

CREATE TRIGGER auth_lockouts_updated_at
BEFORE UPDATE ON public.auth_lockouts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_auth_lockouts_locked_until
ON public.auth_lockouts (locked_until)
WHERE locked_until IS NOT NULL;
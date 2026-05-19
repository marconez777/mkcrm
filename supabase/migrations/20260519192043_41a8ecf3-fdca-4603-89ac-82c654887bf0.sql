
CREATE TABLE public.clinic_email_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'resend',
  secret_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_email_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all email integrations"
  ON public.clinic_email_integrations
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins view their integration"
  ON public.clinic_email_integrations
  FOR SELECT
  USING (public.is_clinic_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_updated_at_generic()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_clinic_email_integrations_updated
  BEFORE UPDATE ON public.clinic_email_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

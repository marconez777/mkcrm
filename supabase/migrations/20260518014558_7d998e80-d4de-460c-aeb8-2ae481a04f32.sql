-- tracking_identity_links: liga visitante anônimo a lead identificado
CREATE TABLE IF NOT EXISTS public.tracking_identity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email_hash text,
  phone_hash text,
  whatsapp_id text,
  link_source text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracking_identity_links_unique UNIQUE (clinic_id, visitor_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_til_clinic_visitor ON public.tracking_identity_links (clinic_id, visitor_id);
CREATE INDEX IF NOT EXISTS idx_til_clinic_lead ON public.tracking_identity_links (clinic_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_til_email_hash ON public.tracking_identity_links (clinic_id, email_hash) WHERE email_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_til_phone_hash ON public.tracking_identity_links (clinic_id, phone_hash) WHERE phone_hash IS NOT NULL;

ALTER TABLE public.tracking_identity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "til_clinic_select" ON public.tracking_identity_links
  FOR SELECT USING (public.has_clinic_access(clinic_id));
CREATE POLICY "til_clinic_admin_write" ON public.tracking_identity_links
  FOR ALL USING (public.has_clinic_access(clinic_id)) WITH CHECK (public.has_clinic_access(clinic_id));

CREATE TRIGGER til_set_updated_at BEFORE UPDATE ON public.tracking_identity_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE IF NOT EXISTS public.deleted_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  lead_id uuid,
  phone text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by_user_id uuid,
  source text NOT NULL DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS idx_deleted_leads_clinic_phone_deleted_at
  ON public.deleted_leads (clinic_id, phone, deleted_at DESC);

ALTER TABLE public.deleted_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deleted_leads_clinic_scoped" ON public.deleted_leads;
CREATE POLICY "deleted_leads_clinic_scoped"
ON public.deleted_leads
FOR ALL
TO authenticated
USING (clinic_id = current_clinic_id())
WITH CHECK (clinic_id = current_clinic_id());
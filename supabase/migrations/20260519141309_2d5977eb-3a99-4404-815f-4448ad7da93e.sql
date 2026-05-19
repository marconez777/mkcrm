ALTER TABLE public.email_automations
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

CREATE TABLE IF NOT EXISTS public.email_automation_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  automation_id uuid NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  recipient_email text NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  source_event text,
  steps_enqueued integer NOT NULL DEFAULT 0,
  UNIQUE (automation_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_eae_clinic ON public.email_automation_enrollments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_eae_lead ON public.email_automation_enrollments(lead_id);

ALTER TABLE public.email_automation_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eae_read_clinic"
  ON public.email_automation_enrollments
  FOR SELECT
  TO authenticated
  USING (has_clinic_access(clinic_id) AND clinic_has_feature(clinic_id, 'email_marketing'));

ALTER TABLE public.email_segment_contacts ALTER COLUMN segment_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_segment_contacts_clinic_email_nosegment_uniq
  ON public.email_segment_contacts (clinic_id, lower(email))
  WHERE segment_id IS NULL;

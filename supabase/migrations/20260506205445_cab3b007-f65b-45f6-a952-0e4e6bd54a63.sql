ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS leads_clinic_phone_key ON public.leads (clinic_id, phone) WHERE phone IS NOT NULL;
DROP INDEX IF EXISTS public.leads_phone_unique;
ALTER TABLE public.lead_custom_fields DROP CONSTRAINT IF EXISTS lead_custom_fields_field_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS lead_custom_fields_clinic_field_key ON public.lead_custom_fields (clinic_id, field_key);
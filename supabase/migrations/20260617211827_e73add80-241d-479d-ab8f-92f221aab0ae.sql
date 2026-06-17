
DROP INDEX IF EXISTS public.leads_clinic_phone_key;
CREATE UNIQUE INDEX leads_clinic_phone_key
  ON public.leads USING btree (clinic_id, phone)
  WHERE (phone IS NOT NULL AND shadow_of_lead_id IS NULL);

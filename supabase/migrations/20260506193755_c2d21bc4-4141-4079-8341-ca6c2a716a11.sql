-- Default per clinic instead of global
DROP INDEX IF EXISTS public.uniq_whatsapp_instances_default;
CREATE UNIQUE INDEX uniq_whatsapp_instances_default_per_clinic
  ON public.whatsapp_instances (clinic_id) WHERE is_default = true;
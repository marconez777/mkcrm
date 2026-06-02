DROP TRIGGER IF EXISTS trg_email_on_lead_created ON public.leads;
DROP TRIGGER IF EXISTS trg_email_on_stage_change ON public.leads;
DROP FUNCTION IF EXISTS public.tg_email_on_lead_created();
DROP FUNCTION IF EXISTS public.tg_email_on_stage_change();

UPDATE public.email_queue
SET status = 'cancelled', updated_at = now()
WHERE status = 'pending' AND related_lead_table LIKE 'auto\_%';
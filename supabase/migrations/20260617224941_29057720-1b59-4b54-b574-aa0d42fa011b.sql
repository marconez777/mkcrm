DELETE FROM pipelines WHERE id = '737242e7-8efc-4a8f-9fed-f09c6e5dc227';

DROP VIEW IF EXISTS public.leads_live;

ALTER TABLE public.leads DROP COLUMN IF EXISTS shadow_of_lead_id;

ALTER TABLE public.leads ENABLE TRIGGER trg_lead_risk_handler;
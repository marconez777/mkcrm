
UPDATE public.leads s
SET needs_ai_review = false,
    ai_review_queued_at = NULL,
    ai_review_reasons = ARRAY['shadow_no_history']::text[]
WHERE s.pipeline_id='17c27f4d-8256-4ea7-b5b9-ed706494f686'
  AND s.shadow_of_lead_id IS NOT NULL
  AND s.needs_ai_review = true
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m WHERE m.lead_id = s.shadow_of_lead_id
  );

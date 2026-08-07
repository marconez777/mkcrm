-- Re-enfileira leads cujo classifier falhou com erro transitório de provider
-- (quota OpenAI, rate-limit, timeout) nas últimas 24h, agora que o pipeline
-- migrou para Gemini via Lovable AI Gateway.
WITH falhas AS (
  SELECT DISTINCT lead_id
  FROM public.lead_events
  WHERE type = 'auto:classifier'
    AND created_at > now() - interval '24 hours'
    AND (payload->>'skipped') LIKE 'agent_error:%'
)
UPDATE public.leads l
SET
  needs_ai_review = true,
  ai_review_reasons = ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(l.ai_review_reasons, '{}'::text[]) || ARRAY['pipeline-classifier']::text[]
    )
  ),
  ai_review_queued_at = now(),
  ai_review_fail_count = 0
FROM falhas f
WHERE l.id = f.lead_id
  AND (l.last_classified_at IS NULL OR l.last_classified_at < now() - interval '5 minutes');
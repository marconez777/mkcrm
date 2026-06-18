
-- 1) Alias B2B / Stakeholders (vários nomes possíveis)
WITH mapping AS (
  SELECT * FROM (VALUES
    ('B2B / Stakeholders', 'B2B / Stakeholders'),
    ('B2B', 'B2B / Stakeholders'),
    ('Stakeholders', 'B2B / Stakeholders'),
    ('Parcerias', 'B2B / Stakeholders'),
    ('B2B / Parcerias', 'B2B / Stakeholders')
  ) AS t(name, canonical)
)
INSERT INTO public.stage_canonical_aliases (clinic_id, pipeline_id, stage_id, canonical_name)
SELECT DISTINCT ps.clinic_id, ps.pipeline_id, ps.id, m.canonical
FROM public.pipeline_stages ps
JOIN mapping m ON LOWER(ps.name) = LOWER(m.name)
ON CONFLICT (pipeline_id, canonical_name) DO NOTHING;

-- 2) Trigger de enfileiramento do classifier em mensagens inbound
CREATE OR REPLACE FUNCTION public.tg_enqueue_classifier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.from_me IS NOT TRUE THEN
    UPDATE public.leads
    SET
      needs_ai_review = true,
      ai_review_queued_at = COALESCE(ai_review_queued_at, now() + interval '5 seconds'),
      ai_review_reasons = CASE
        WHEN 'pipeline-classifier' = ANY(COALESCE(ai_review_reasons, ARRAY[]::text[]))
          THEN ai_review_reasons
        ELSE COALESCE(ai_review_reasons, ARRAY[]::text[]) || ARRAY['pipeline-classifier']
      END
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_messages_enqueue_classifier ON public.messages;
CREATE TRIGGER trg_messages_enqueue_classifier
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_classifier();

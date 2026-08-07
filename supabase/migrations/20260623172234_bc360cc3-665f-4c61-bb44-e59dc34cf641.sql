ALTER TABLE public.ai_usage
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'unknown';

UPDATE public.ai_usage
SET source = 'classifier-runtime'
WHERE source = 'unknown' AND operation LIKE 'classifier:%';

CREATE INDEX IF NOT EXISTS idx_ai_usage_source_created
  ON public.ai_usage (source, created_at DESC);

COMMENT ON COLUMN public.ai_usage.source IS
  'Origem da chamada IA: pipeline-runtime | classifier-runtime | ai-auto-reply | unknown. Fase 11 — reconciliação de telemetria.';
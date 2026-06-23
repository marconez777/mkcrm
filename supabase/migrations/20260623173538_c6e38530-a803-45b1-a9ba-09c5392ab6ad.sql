ALTER TABLE public.ai_usage
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS agent_step text,
  ADD COLUMN IF NOT EXISTS error_category text,
  ADD COLUMN IF NOT EXISTS error_details jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.ai_usage
SET source = 'classifier-runtime'
WHERE operation LIKE 'classifier:%'
  AND (source IS NULL OR source = 'unknown');

UPDATE public.ai_usage
SET agent_step = split_part(operation, ':', 2)
WHERE operation LIKE 'classifier:%'
  AND (agent_step IS NULL OR agent_step = '');

UPDATE public.ai_usage
SET provider = CASE
    WHEN model LIKE 'google/%' OR model ILIKE '%gemini%' THEN 'lovable'
    WHEN model ILIKE 'gpt-%' OR model ILIKE 'o%' THEN 'openai'
    ELSE provider
  END
WHERE operation LIKE 'classifier:%'
  AND (provider IS NULL OR provider = '');

UPDATE public.ai_usage
SET error_category = CASE
    WHEN error IS NULL OR error = '' THEN NULL
    WHEN error ILIKE '%quota%' OR error ILIKE '%billing%' OR error ILIKE '%payment required%' OR error ILIKE '%402%' OR error ILIKE '%exceeded your current%' THEN 'quota_or_billing'
    WHEN error ILIKE '%rate limit%' OR error ILIKE '%rate_limit%' OR error ILIKE '%429%' THEN 'rate_limit'
    WHEN error ILIKE '%timeout%' OR error ILIKE '%timed out%' THEN 'timeout'
    WHEN error ILIKE '%No object generated%' OR error ILIKE '%schema_retry_failed%' OR error ILIKE '%did not match schema%' OR error ILIKE '%Output validation%' THEN 'schema_validation'
    WHEN error ILIKE '%fetch failed%' OR error ILIKE '%network%' OR error ILIKE '%ECONN%' THEN 'network'
    WHEN error ~ '5[0-9][0-9]' THEN 'gateway_5xx'
    ELSE 'unknown'
  END
WHERE status <> 'success'
  AND (error_category IS NULL OR error_category = '');

CREATE INDEX IF NOT EXISTS idx_ai_usage_source_created
  ON public.ai_usage (source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_error_category_created
  ON public.ai_usage (error_category, created_at DESC)
  WHERE status <> 'success';

COMMENT ON COLUMN public.ai_usage.source IS 'Origem da chamada IA: classifier-runtime, pipeline-runtime, ai-auto-reply ou unknown.';
COMMENT ON COLUMN public.ai_usage.provider IS 'Provider lógico usado na chamada, por exemplo lovable ou openai.';
COMMENT ON COLUMN public.ai_usage.agent_step IS 'Etapa do agente no pipeline, por exemplo summarizer, agendador, typifier, movimentador ou maestro.';
COMMENT ON COLUMN public.ai_usage.error_category IS 'Categoria normalizada do erro para agrupamento e diagnóstico operacional.';
COMMENT ON COLUMN public.ai_usage.error_details IS 'Detalhes estruturados e resumidos do erro, sem segredos nem payload completo.';
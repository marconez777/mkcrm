ALTER TABLE public.pipeline_run_items
  ADD COLUMN IF NOT EXISTS auto_retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_retry_pending boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pri_auto_retry_pending
  ON public.pipeline_run_items (finished_at)
  WHERE auto_retry_pending = true;

COMMENT ON COLUMN public.pipeline_run_items.auto_retry_count IS
  'Quantas vezes o cron pipeline-auto-retry já tentou reprocessar este item.';
COMMENT ON COLUMN public.pipeline_run_items.auto_retry_pending IS
  'true quando o item falhou com erro transitório e aguarda re-enfileiramento automático.';
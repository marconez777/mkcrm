ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS is_terminal boolean NOT NULL DEFAULT false;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_classified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_last_classified_at
  ON public.leads (last_classified_at);
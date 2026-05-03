
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS marked_unread boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_summary_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_pinned_at ON public.leads(pinned_at DESC NULLS LAST);

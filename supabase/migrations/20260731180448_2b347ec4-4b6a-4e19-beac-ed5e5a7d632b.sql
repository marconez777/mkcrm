ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS origin_channel text,
  ADD COLUMN IF NOT EXISTS origin_label text,
  ADD COLUMN IF NOT EXISTS origin_detail text,
  ADD COLUMN IF NOT EXISTS origin_source_type text,
  ADD COLUMN IF NOT EXISTS origin_locked_by_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origin_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_origin_channel
  ON public.leads (clinic_id, origin_channel);

COMMENT ON COLUMN public.leads.origin_channel IS
  'Canal canônico de origem: google_organic|google_ads|meta_ads|instagram|facebook|youtube|email|referral|form|whatsapp_direct|test|other|unknown';
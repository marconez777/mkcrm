ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS segment_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.email_campaigns
SET segment_ids = ARRAY[segment_id]
WHERE segment_id IS NOT NULL
  AND (segment_ids IS NULL OR array_length(segment_ids, 1) IS NULL);
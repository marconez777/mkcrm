
ALTER TABLE public.tracking_sessions ADD COLUMN IF NOT EXISTS ref_short text;

UPDATE public.tracking_sessions
SET ref_short = lower(replace(id::text, '-', ''))
WHERE ref_short IS NULL;

CREATE INDEX IF NOT EXISTS tracking_sessions_clinic_refshort_idx
  ON public.tracking_sessions (clinic_id, ref_short);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ai_review_fail_count int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.try_classify_lock(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_xact_lock(hashtext('classify:'||_lead_id::text));
$$;

GRANT EXECUTE ON FUNCTION public.try_classify_lock(uuid) TO service_role;
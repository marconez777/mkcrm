
ALTER TABLE public.form_integrations
  ADD COLUMN IF NOT EXISTS token_set boolean
    GENERATED ALWAYS AS (token IS NOT NULL AND length(token) > 0) STORED,
  ADD COLUMN IF NOT EXISTS previous_token_set boolean
    GENERATED ALWAYS AS (previous_token IS NOT NULL AND length(previous_token) > 0) STORED;

REVOKE SELECT ON public.form_integrations FROM authenticated, anon;

GRANT SELECT (
  id, clinic_id, name, slug, previous_token_expires_at, allowed_domains,
  status, default_pipeline_stage_id, default_tags, total_submissions,
  last_submission_at, created_by, created_at, updated_at,
  token_set, previous_token_set
) ON public.form_integrations TO authenticated;

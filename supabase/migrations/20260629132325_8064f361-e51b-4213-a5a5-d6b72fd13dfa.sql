ALTER TABLE public.clinic_secrets
  ADD COLUMN IF NOT EXISTS gemini_api_key text,
  ADD COLUMN IF NOT EXISTS gemini_key_last4 text,
  ADD COLUMN IF NOT EXISTS gemini_status text NOT NULL DEFAULT 'empty',
  ADD COLUMN IF NOT EXISTS gemini_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS gemini_last_error text,
  ADD COLUMN IF NOT EXISTS active_ai_provider text NOT NULL DEFAULT 'openai';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_secrets_active_ai_provider_chk') THEN
    ALTER TABLE public.clinic_secrets
      ADD CONSTRAINT clinic_secrets_active_ai_provider_chk
      CHECK (active_ai_provider IN ('openai','gemini'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_secrets_gemini_status_chk') THEN
    ALTER TABLE public.clinic_secrets
      ADD CONSTRAINT clinic_secrets_gemini_status_chk
      CHECK (gemini_status IN ('empty','configured','invalid'));
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_clinic_openai_status(uuid);

CREATE OR REPLACE FUNCTION public.get_clinic_openai_status(_clinic_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
      'openai_status', COALESCE(cs.openai_status, 'empty'),
      'openai_key_last4', cs.openai_key_last4,
      'openai_last_checked_at', cs.openai_last_checked_at,
      'openai_last_error', cs.openai_last_error,
      'gemini_status', COALESCE(cs.gemini_status, 'empty'),
      'gemini_key_last4', cs.gemini_key_last4,
      'gemini_last_checked_at', cs.gemini_last_checked_at,
      'gemini_last_error', cs.gemini_last_error,
      'active_ai_provider', COALESCE(cs.active_ai_provider, 'openai'),
      'updated_at', cs.updated_at
    )
    FROM public.clinic_secrets cs
    WHERE cs.clinic_id = _clinic_id),
    jsonb_build_object(
      'openai_status', 'empty',
      'openai_key_last4', null,
      'openai_last_checked_at', null,
      'openai_last_error', null,
      'gemini_status', 'empty',
      'gemini_key_last4', null,
      'gemini_last_checked_at', null,
      'gemini_last_error', null,
      'active_ai_provider', 'openai',
      'updated_at', null
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_clinic_ai_secrets(_clinic_id uuid)
RETURNS TABLE (
  openai_api_key text,
  gemini_api_key text,
  active_ai_provider text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cs.openai_api_key,
    cs.gemini_api_key,
    COALESCE(cs.active_ai_provider, 'openai') AS active_ai_provider
  FROM public.clinic_secrets cs
  WHERE cs.clinic_id = _clinic_id;
$$;

REVOKE ALL ON FUNCTION public.get_clinic_ai_secrets(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_clinic_ai_secrets(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_ai_secrets(uuid) TO service_role;
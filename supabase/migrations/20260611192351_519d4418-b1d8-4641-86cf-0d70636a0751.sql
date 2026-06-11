
-- =========================================================
-- F0: Pipeline Clínica + IA — schema base
-- =========================================================

-- 1) Colunas novas em tabelas existentes
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_automated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vision_processed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_audio_transcription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcript_status text,
  ADD COLUMN IF NOT EXISTS transcript_cost_usd numeric(10,6);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS needs_ai_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_review_reasons text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS ai_review_queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_lock_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_needs_ai_review
  ON public.leads (clinic_id, ai_review_queued_at)
  WHERE needs_ai_review = true;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS classifier_config jsonb NOT NULL DEFAULT jsonb_build_object(
    'manual_lock_minutes', 30,
    'confidence_threshold', 0.7,
    'max_messages_per_extraction', 8,
    'max_extractions_per_lead_per_day', 3,
    'daily_budget_extractions', 200,
    'max_vision_per_lead', 3,
    'daily_budget_vision', 50,
    'daily_budget_audio_minutes', 60,
    'allow_overwrite_filled', false,
    'openai_status', 'empty',
    'openai_model_text', 'gpt-5-nano',
    'openai_model_vision', 'gpt-5-mini',
    'openai_model_audio', 'whisper-1'
  );

ALTER TABLE public.lead_stage_history
  ADD COLUMN IF NOT EXISTS reason text;

-- 2) Tabela: clinic_secrets (BYOK OpenAI)
CREATE TABLE IF NOT EXISTS public.clinic_secrets (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  openai_api_key text,                 -- chave em texto; nunca exposta via PostgREST
  openai_key_last4 text,                -- últimos 4 chars (UI-safe)
  openai_status text NOT NULL DEFAULT 'empty', -- empty|configured|invalid
  openai_last_checked_at timestamptz,
  openai_last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTs: APENAS service_role. Nada de anon/authenticated.
GRANT ALL ON public.clinic_secrets TO service_role;

ALTER TABLE public.clinic_secrets ENABLE ROW LEVEL SECURITY;

-- Sem policies = ninguém via PostgREST consegue ler/escrever.
-- service_role bypassa RLS.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinic_secrets_set_updated_at ON public.clinic_secrets;
CREATE TRIGGER clinic_secrets_set_updated_at
  BEFORE UPDATE ON public.clinic_secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Tabela: lead_ai_extraction_runs
DO $$ BEGIN
  CREATE TYPE public.lead_ai_extraction_kind AS ENUM ('text','vision','audio','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.lead_ai_extraction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  kind public.lead_ai_extraction_kind NOT NULL,
  model text,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  fields_set jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(4,3),
  skipped_reason text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lead_ai_extraction_runs TO authenticated;
GRANT ALL    ON public.lead_ai_extraction_runs TO service_role;

ALTER TABLE public.lead_ai_extraction_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extraction_runs_tenant_select"
  ON public.lead_ai_extraction_runs
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());

-- inserts/updates só via service_role (edge functions). Nada pra authenticated.

CREATE INDEX IF NOT EXISTS idx_extraction_runs_clinic_day
  ON public.lead_ai_extraction_runs (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_runs_lead
  ON public.lead_ai_extraction_runs (lead_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_extraction_runs_msg_kind
  ON public.lead_ai_extraction_runs (lead_id, message_id, kind)
  WHERE message_id IS NOT NULL;

-- 4) Função pra edge functions lerem a chave (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_openai_key(_clinic_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT openai_api_key
  FROM public.clinic_secrets
  WHERE clinic_id = _clinic_id
$$;

-- Bloqueia execução pra anon/authenticated; só service_role chama
REVOKE ALL ON FUNCTION public.get_openai_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_openai_key(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_openai_key(uuid) TO service_role;

-- 5) View segura pro frontend ler STATUS (sem a chave)
CREATE OR REPLACE VIEW public.clinic_openai_status AS
SELECT
  clinic_id,
  openai_status,
  openai_key_last4,
  openai_last_checked_at,
  openai_last_error,
  updated_at
FROM public.clinic_secrets;

GRANT SELECT ON public.clinic_openai_status TO authenticated;

-- A view herda RLS via security_invoker; mas como clinic_secrets não tem
-- policy pra authenticated, precisamos de uma policy explícita. Solução:
-- recriar view com security_invoker=false (definer) + filtro manual.
DROP VIEW IF EXISTS public.clinic_openai_status;
CREATE VIEW public.clinic_openai_status
WITH (security_invoker = false) AS
SELECT
  cs.clinic_id,
  cs.openai_status,
  cs.openai_key_last4,
  cs.openai_last_checked_at,
  cs.openai_last_error,
  cs.updated_at
FROM public.clinic_secrets cs
WHERE cs.clinic_id = public.current_clinic_id()
   OR public.is_super_admin();

GRANT SELECT ON public.clinic_openai_status TO authenticated;

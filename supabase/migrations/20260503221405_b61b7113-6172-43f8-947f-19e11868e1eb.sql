ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS api_key text,
  ADD COLUMN IF NOT EXISTS base_url text,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_api_key text;

ALTER TABLE public.ai_agents
  ADD CONSTRAINT ai_agents_provider_chk CHECK (provider IN ('openai','anthropic','google'));
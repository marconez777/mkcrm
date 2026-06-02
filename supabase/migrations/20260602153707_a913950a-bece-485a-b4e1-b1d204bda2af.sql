ALTER TABLE public.ai_chat_traces
  ADD COLUMN IF NOT EXISTS stage_meta jsonb;
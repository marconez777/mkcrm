
ALTER TABLE public.pending_replies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pending_replies_status_run
  ON public.pending_replies (status, run_at);

ALTER TABLE public.ai_usage
  ADD COLUMN IF NOT EXISTS cost_usd numeric(12,6);

CREATE INDEX IF NOT EXISTS idx_ai_usage_cost
  ON public.ai_usage (clinic_id, created_at DESC) WHERE cost_usd IS NOT NULL;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS bot_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_bot_agent
  ON public.messages (bot_agent_id) WHERE bot_agent_id IS NOT NULL;

DROP POLICY IF EXISTS "embedding_cache_read_authenticated" ON public.embedding_cache;
CREATE POLICY "embedding_cache_read_authenticated"
  ON public.embedding_cache
  FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.cleanup_agent_caches()
RETURNS void
LANGUAGE sql
SET search_path TO 'public'
AS $function$
  DELETE FROM public.rag_cache WHERE created_at < now() - interval '1 hour';
  DELETE FROM public.webhook_dedup WHERE expires_at < now();
  DELETE FROM public.lead_reply_counters WHERE hour_bucket < now() - interval '7 days';
  DELETE FROM public.agent_traces WHERE created_at < now() - interval '14 days';
  DELETE FROM public.ai_usage WHERE created_at < now() - interval '90 days';
  DELETE FROM public.embedding_cache WHERE created_at < now() - interval '30 days';
$function$;

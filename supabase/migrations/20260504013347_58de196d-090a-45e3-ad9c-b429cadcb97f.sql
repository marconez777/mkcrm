
-- Cache de embeddings (evita re-embedar mesmo texto)
CREATE TABLE IF NOT EXISTS public.embedding_cache (
  text_hash text NOT NULL,
  model text NOT NULL,
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (text_hash, model)
);
ALTER TABLE public.embedding_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.embedding_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Cache de retrieval (mesma query em janela curta reusa chunks)
CREATE TABLE IF NOT EXISTS public.rag_cache (
  agent_id uuid NOT NULL,
  query_hash text NOT NULL,
  chunks jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, query_hash)
);
ALTER TABLE public.rag_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.rag_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Traces de execução para observabilidade (cascata de tools, latência por etapa)
CREATE TABLE IF NOT EXISTS public.agent_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid,
  thread_id uuid,
  lead_id uuid,
  run_id uuid NOT NULL,
  step int NOT NULL,
  kind text NOT NULL, -- 'llm', 'tool', 'rag', 'mcp', 'guard'
  name text,
  latency_ms int,
  tokens_in int,
  tokens_out int,
  error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_traces_run_idx ON public.agent_traces(run_id, step);
CREATE INDEX IF NOT EXISTS agent_traces_agent_time_idx ON public.agent_traces(agent_id, created_at DESC);
ALTER TABLE public.agent_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.agent_traces FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dedup de webhook (evita reprocessamento de redelivery do Evolution)
CREATE TABLE IF NOT EXISTS public.webhook_dedup (
  event_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes')
);
CREATE INDEX IF NOT EXISTS webhook_dedup_expires_idx ON public.webhook_dedup(expires_at);
ALTER TABLE public.webhook_dedup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.webhook_dedup FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Contador de respostas por lead (rate limit anti-loop catastrófico)
CREATE TABLE IF NOT EXISTS public.lead_reply_counters (
  lead_id uuid NOT NULL,
  hour_bucket timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  last_bot_sent_at timestamptz,
  PRIMARY KEY (lead_id, hour_bucket)
);
ALTER TABLE public.lead_reply_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.lead_reply_counters FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Coluna de orçamento de tool calls
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS max_tool_calls int NOT NULL DEFAULT 12;

-- Função utilitária: registrar passo de trace
CREATE OR REPLACE FUNCTION public.log_agent_trace(
  p_run_id uuid, p_agent_id uuid, p_thread_id uuid, p_lead_id uuid,
  p_step int, p_kind text, p_name text,
  p_latency_ms int, p_tokens_in int, p_tokens_out int,
  p_error text, p_payload jsonb
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.agent_traces(run_id, agent_id, thread_id, lead_id, step, kind, name, latency_ms, tokens_in, tokens_out, error, payload)
  VALUES (p_run_id, p_agent_id, p_thread_id, p_lead_id, p_step, p_kind, p_name, p_latency_ms, p_tokens_in, p_tokens_out, p_error, p_payload);
$$;

-- Limpeza de caches expirados
CREATE OR REPLACE FUNCTION public.cleanup_agent_caches()
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  DELETE FROM public.rag_cache WHERE created_at < now() - interval '1 hour';
  DELETE FROM public.webhook_dedup WHERE expires_at < now();
  DELETE FROM public.lead_reply_counters WHERE hour_bucket < now() - interval '7 days';
  DELETE FROM public.agent_traces WHERE created_at < now() - interval '14 days';
$$;

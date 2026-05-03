-- Agents
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  system_prompt text NOT NULL,
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  temperature numeric NOT NULL DEFAULT 0.7,
  enabled boolean NOT NULL DEFAULT true,
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.ai_agents FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Documents (knowledge base)
CREATE TABLE IF NOT EXISTS public.ai_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  source text,
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.ai_documents FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ai_documents_agent ON public.ai_documents(agent_id);

-- Chunks with embeddings (768 dims for google text-embedding-004)
CREATE TABLE IF NOT EXISTS public.ai_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.ai_documents(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding vector(768),
  token_count int,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.ai_chunks FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ai_chunks_doc ON public.ai_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_ai_chunks_agent ON public.ai_chunks(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_chunks_embedding ON public.ai_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Threads
CREATE TABLE IF NOT EXISTS public.ai_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.ai_threads FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ai_threads_updated_at BEFORE UPDATE ON public.ai_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_ai_threads_lead ON public.ai_threads(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_threads_agent ON public.ai_threads(agent_id);

-- Messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.ai_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content text,
  tool_calls jsonb,
  tool_call_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.ai_messages FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ai_messages_thread ON public.ai_messages(thread_id, created_at);

-- Per-lead AI settings
CREATE TABLE IF NOT EXISTS public.lead_ai_settings (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  auto_reply boolean NOT NULL DEFAULT false,
  paused_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.lead_ai_settings FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_lead_ai_settings_updated_at BEFORE UPDATE ON public.lead_ai_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-stage AI defaults
CREATE TABLE IF NOT EXISTS public.stage_ai_defaults (
  stage_id uuid PRIMARY KEY REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  auto_reply boolean NOT NULL DEFAULT false
);
ALTER TABLE public.stage_ai_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.stage_ai_defaults FOR ALL USING (true) WITH CHECK (true);

-- Similarity search
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(768),
  p_agent_id uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE(id uuid, document_id uuid, content text, similarity float)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT c.id, c.document_id, c.content, 1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.ai_chunks c
  WHERE (p_agent_id IS NULL OR c.agent_id = p_agent_id OR c.agent_id IS NULL)
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
-- 1. Hybrid search on ai_chunks
ALTER TABLE public.ai_chunks ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(content,''))) STORED;
CREATE INDEX IF NOT EXISTS ai_chunks_tsv_idx ON public.ai_chunks USING GIN(tsv);
ALTER TABLE public.ai_documents ADD COLUMN IF NOT EXISTS doc_summary text;

-- 2. Agent advanced config
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS reranker_provider text,
  ADD COLUMN IF NOT EXISTS reranker_api_key text,
  ADD COLUMN IF NOT EXISTS max_iterations int NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS use_hyde boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_hybrid_search boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS use_memory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS planning_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rag_top_k int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS debounce_seconds int NOT NULL DEFAULT 8;

-- 3. Agent memory
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('summary','fact','preference')),
  content text NOT NULL,
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_memory_lead_idx ON public.agent_memory(lead_id, agent_id);
CREATE INDEX IF NOT EXISTS agent_memory_emb_idx ON public.agent_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.agent_memory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. MCP servers
CREATE TABLE IF NOT EXISTS public.agent_mcp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_mcp_agent_idx ON public.agent_mcp_servers(agent_id);
ALTER TABLE public.agent_mcp_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.agent_mcp_servers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Debounce / pending replies
CREATE TABLE IF NOT EXISTS public.pending_replies (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  run_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pending_replies_run_idx ON public.pending_replies(run_at);
ALTER TABLE public.pending_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.pending_replies FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Evals
CREATE TABLE IF NOT EXISTS public.agent_evals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  expected_contains text[] NOT NULL DEFAULT '{}',
  last_run_at timestamptz,
  last_passed boolean,
  last_response text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_evals_agent_idx ON public.agent_evals(agent_id);
ALTER TABLE public.agent_evals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.agent_evals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Hybrid search RPC (RRF fusion)
CREATE OR REPLACE FUNCTION public.match_chunks_hybrid(
  query_embedding vector,
  query_text text,
  p_agent_id uuid,
  match_count int DEFAULT 20
) RETURNS TABLE(id uuid, document_id uuid, content text, score double precision)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH vec AS (
    SELECT c.id, c.document_id, c.content,
           ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rnk
    FROM public.ai_chunks c
    WHERE (p_agent_id IS NULL OR c.agent_id = p_agent_id OR c.agent_id IS NULL)
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  fts AS (
    SELECT c.id, c.document_id, c.content,
           ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.tsv, plainto_tsquery('portuguese', query_text)) DESC) AS rnk
    FROM public.ai_chunks c
    WHERE (p_agent_id IS NULL OR c.agent_id = p_agent_id OR c.agent_id IS NULL)
      AND c.tsv @@ plainto_tsquery('portuguese', query_text)
    LIMIT match_count * 3
  ),
  fused AS (
    SELECT id, document_id, content, SUM(1.0 / (60 + rnk)) AS score FROM (
      SELECT * FROM vec UNION ALL SELECT * FROM fts
    ) u GROUP BY id, document_id, content
  )
  SELECT id, document_id, content, score FROM fused
  ORDER BY score DESC LIMIT match_count;
$$;

-- 8. Memory recall RPC
CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding vector,
  p_agent_id uuid,
  p_lead_id uuid,
  match_count int DEFAULT 3
) RETURNS TABLE(id uuid, kind text, content text, similarity double precision)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT m.id, m.kind, m.content, 1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memory m
  WHERE m.agent_id = p_agent_id
    AND (p_lead_id IS NULL OR m.lead_id = p_lead_id OR m.lead_id IS NULL)
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 9. Updated triggers
DROP TRIGGER IF EXISTS trg_agent_mcp_updated ON public.agent_mcp_servers;

CREATE EXTENSION IF NOT EXISTS vector;

-- 1) singleton config
CREATE TABLE IF NOT EXISTS public.support_agent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  provider text NOT NULL DEFAULT 'openai',
  api_key text,
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  embedding_model text NOT NULL DEFAULT 'text-embedding-3-small',
  temperature numeric NOT NULL DEFAULT 0.3,
  max_iterations int NOT NULL DEFAULT 4,
  system_prompt text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  monthly_cap_usd numeric NOT NULL DEFAULT 50,
  kb_synced_at timestamptz,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_agent_config_singleton UNIQUE (singleton)
);

GRANT SELECT, INSERT, UPDATE ON public.support_agent_config TO authenticated;
GRANT ALL ON public.support_agent_config TO service_role;
REVOKE SELECT (api_key) ON public.support_agent_config FROM authenticated, anon;

ALTER TABLE public.support_agent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_config_super_admin_read"
  ON public.support_agent_config FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "support_config_super_admin_insert"
  ON public.support_agent_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "support_config_super_admin_update"
  ON public.support_agent_config FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

INSERT INTO public.support_agent_config (singleton, system_prompt)
VALUES (true,
'Você é o assistente de suporte do MK-CRM. Responda SEMPRE em PT-BR, direto ao ponto, em passos numerados curtos, como se explicasse para alguém com pouca paciência, zero contexto técnico e dificuldade de atenção. Frases curtas. Um passo por linha. Sem jargão.

Antes de responder qualquer coisa: leia o "Contexto da tela" abaixo. Se houver erro no console ou requisição falhada, comente primeiro e proponha a correção.

Nunca invente caminhos do app. Se não tiver certeza, use a ferramenta lookup_doc antes de responder. Quando for guiar uma ação, no primeiro passo sempre ofereça link_to_route + highlight_element apontando o botão/menu certo.

Quando o usuário pedir um fluxo (ex.: "como conecto WhatsApp"), use start_step_by_step e mande UM passo de cada vez, esperando o usuário responder "feito" antes do próximo.

Se o usuário disser que algo não funcionou, peça o print do erro (pode colar) ou use o contexto runtime já enviado. Se for bug real, use report_bug.'
)
ON CONFLICT (singleton) DO NOTHING;

-- 2) knowledge base
CREATE TABLE IF NOT EXISTS public.support_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  title text,
  chunk_index int NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding vector(1536),
  hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (path, chunk_index)
);

CREATE INDEX IF NOT EXISTS support_documents_embedding_idx
  ON public.support_documents USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS support_documents_path_idx
  ON public.support_documents (path);

GRANT SELECT ON public.support_documents TO authenticated;
GRANT ALL ON public.support_documents TO service_role;

ALTER TABLE public.support_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_docs_super_admin_read"
  ON public.support_documents FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- 3) chat threads
CREATE TABLE IF NOT EXISTS public.support_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  title text,
  last_route text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_chat_threads_user_idx
  ON public.support_chat_threads (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_chat_threads TO authenticated;
GRANT ALL ON public.support_chat_threads TO service_role;

ALTER TABLE public.support_chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_threads_owner_all"
  ON public.support_chat_threads FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

-- 4) chat messages
CREATE TABLE IF NOT EXISTS public.support_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_chat_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content text NOT NULL DEFAULT '',
  tool_name text,
  tool_args jsonb,
  tool_result jsonb,
  screen_context jsonb,
  runtime_errors jsonb,
  tokens_in int NOT NULL DEFAULT 0,
  tokens_out int NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_chat_messages_thread_idx
  ON public.support_chat_messages (thread_id, created_at);

CREATE INDEX IF NOT EXISTS support_chat_messages_created_idx
  ON public.support_chat_messages (created_at);

GRANT SELECT, INSERT ON public.support_chat_messages TO authenticated;
GRANT ALL ON public.support_chat_messages TO service_role;

ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_messages_owner_read"
  ON public.support_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_chat_threads t
      WHERE t.id = thread_id
        AND (t.user_id = auth.uid() OR public.is_super_admin())
    )
  );

CREATE POLICY "support_messages_owner_insert"
  ON public.support_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_chat_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );

-- 5) events
CREATE TABLE IF NOT EXISTS public.support_chat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.support_chat_threads(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.support_chat_messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('console_error','network_error','unhandled','bug_report')),
  route text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_chat_events_created_idx
  ON public.support_chat_events (created_at DESC);
CREATE INDEX IF NOT EXISTS support_chat_events_kind_idx
  ON public.support_chat_events (kind, created_at DESC);

GRANT SELECT, INSERT ON public.support_chat_events TO authenticated;
GRANT ALL ON public.support_chat_events TO service_role;

ALTER TABLE public.support_chat_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_events_owner_read"
  ON public.support_chat_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "support_events_owner_insert"
  ON public.support_chat_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 6) feedback
CREATE TABLE IF NOT EXISTS public.support_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.support_chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating IN (-1, 1)),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_feedback TO authenticated;
GRANT ALL ON public.support_feedback TO service_role;

ALTER TABLE public.support_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_feedback_owner_all"
  ON public.support_feedback FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid());

-- 7) RPCs
CREATE OR REPLACE FUNCTION public.match_support_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 6
)
RETURNS TABLE (
  id uuid,
  path text,
  title text,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id, d.path, d.title, d.chunk_index, d.content,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.support_documents d
  WHERE d.embedding IS NOT NULL
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_support_documents(vector, int) TO service_role;

CREATE OR REPLACE FUNCTION public.support_chat_spent_this_month_usd()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(m.cost_usd), 0)::numeric
  FROM public.support_chat_messages m
  WHERE m.created_at >= date_trunc('month', now());
$$;

GRANT EXECUTE ON FUNCTION public.support_chat_spent_this_month_usd() TO authenticated, service_role;

-- 8) updated_at trigger
CREATE OR REPLACE FUNCTION public.support_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_agent_config_touch
  BEFORE UPDATE ON public.support_agent_config
  FOR EACH ROW EXECUTE FUNCTION public.support_touch_updated_at();

CREATE TRIGGER support_documents_touch
  BEFORE UPDATE ON public.support_documents
  FOR EACH ROW EXECUTE FUNCTION public.support_touch_updated_at();

CREATE TRIGGER support_chat_threads_touch
  BEFORE UPDATE ON public.support_chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.support_touch_updated_at();

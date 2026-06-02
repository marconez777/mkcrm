CREATE TABLE public.ai_chat_traces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'test_lab' CHECK (source IN ('test_lab', 'production')),
  lead_id uuid,
  persona_id uuid REFERENCES public.agent_personas(id) ON DELETE SET NULL,
  user_message text,
  agent_message text,
  system_prompt_excerpt text,
  kb_hits jsonb NOT NULL DEFAULT '[]'::jsonb,
  tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  tokens_in integer,
  tokens_out integer,
  latency_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX ai_chat_traces_agent_created_idx ON public.ai_chat_traces(agent_id, created_at DESC);
CREATE INDEX ai_chat_traces_clinic_idx ON public.ai_chat_traces(clinic_id);

GRANT SELECT ON public.ai_chat_traces TO authenticated;
GRANT ALL ON public.ai_chat_traces TO service_role;

ALTER TABLE public.ai_chat_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_chat_traces_select ON public.ai_chat_traces
  FOR SELECT
  USING (clinic_id = current_clinic_id() AND current_clinic_has_feature('agents'));

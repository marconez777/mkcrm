-- Phase 4: templates, AI metrics, batch ingestion support

-- Message templates with variable interpolation
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  shortcut text,
  content text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.message_templates FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AI usage metrics for cost/latency/throughput dashboards
CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid,
  automation_id uuid,
  lead_id uuid,
  thread_id uuid,
  model text NOT NULL,
  operation text NOT NULL DEFAULT 'chat', -- chat | embed | tool
  status text NOT NULL DEFAULT 'success', -- success | error | rate_limit | no_credits
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  latency_ms integer,
  tools_called integer NOT NULL DEFAULT 0,
  replied boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.ai_usage FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_ai_usage_created_at ON public.ai_usage (created_at DESC);
CREATE INDEX idx_ai_usage_agent ON public.ai_usage (agent_id, created_at DESC);
CREATE INDEX idx_ai_usage_automation ON public.ai_usage (automation_id, created_at DESC);
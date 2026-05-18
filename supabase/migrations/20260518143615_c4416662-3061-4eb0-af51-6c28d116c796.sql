
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT public.current_clinic_id(),
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  thread_id uuid,
  period_start timestamptz,
  period_end timestamptz NOT NULL DEFAULT now(),
  summary text NOT NULL,
  sentiment text,
  top_objections jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_doubts jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  drop_off_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_clinic_created ON public.ai_insights(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_lead ON public.ai_insights(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_agent ON public.ai_insights(agent_id, created_at DESC);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_insights_select" ON public.ai_insights FOR SELECT
  TO authenticated USING (public.has_clinic_access(clinic_id));
CREATE POLICY "ai_insights_insert" ON public.ai_insights FOR INSERT
  TO authenticated WITH CHECK (public.has_clinic_access(clinic_id));
CREATE POLICY "ai_insights_update" ON public.ai_insights FOR UPDATE
  TO authenticated USING (public.has_clinic_access(clinic_id));
CREATE POLICY "ai_insights_delete" ON public.ai_insights FOR DELETE
  TO authenticated USING (public.has_clinic_access(clinic_id));

CREATE TRIGGER trg_ai_insights_clinic_id_not_null
  BEFORE INSERT ON public.ai_insights
  FOR EACH ROW EXECUTE FUNCTION public.assert_clinic_id_not_null();

CREATE INDEX IF NOT EXISTS idx_ai_agents_clinic_role ON public.ai_agents(clinic_id, role) WHERE role IS NOT NULL;

-- Phase 16: Thread classifications for learning from production
CREATE TABLE public.lead_thread_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT current_clinic_id() REFERENCES public.clinics(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  label text NOT NULL,
  note text,
  anchor_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  promoted_eval_id uuid REFERENCES public.agent_evals(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_thread_classifications_label_check CHECK (label IN ('good','problem','objection','doubt'))
);

CREATE INDEX idx_thread_class_clinic ON public.lead_thread_classifications(clinic_id, created_at DESC);
CREATE INDEX idx_thread_class_agent ON public.lead_thread_classifications(agent_id, created_at DESC);
CREATE INDEX idx_thread_class_lead ON public.lead_thread_classifications(lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_thread_classifications TO authenticated;
GRANT ALL ON public.lead_thread_classifications TO service_role;

ALTER TABLE public.lead_thread_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_scoped" ON public.lead_thread_classifications
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());

CREATE TRIGGER set_updated_at_thread_class
  BEFORE UPDATE ON public.lead_thread_classifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
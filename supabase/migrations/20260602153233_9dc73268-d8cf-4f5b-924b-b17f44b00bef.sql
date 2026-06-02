CREATE TABLE public.agent_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL DEFAULT current_clinic_id(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  order_idx integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  goal text,
  system_prompt_delta text,
  advance_when text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX agent_stages_agent_order_idx ON public.agent_stages(agent_id, order_idx);
CREATE INDEX agent_stages_clinic_idx ON public.agent_stages(clinic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_stages TO authenticated;
GRANT ALL ON public.agent_stages TO service_role;

ALTER TABLE public.agent_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_stages_select ON public.agent_stages
  FOR SELECT
  USING (clinic_id = current_clinic_id() AND current_clinic_has_feature('agents'));

CREATE POLICY agent_stages_admin_write ON public.agent_stages
  FOR ALL
  USING (clinic_id = current_clinic_id() AND is_clinic_admin() AND current_clinic_has_feature('agents'))
  WITH CHECK (clinic_id = current_clinic_id() AND is_clinic_admin() AND current_clinic_has_feature('agents'));

CREATE TRIGGER update_agent_stages_updated_at
  BEFORE UPDATE ON public.agent_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
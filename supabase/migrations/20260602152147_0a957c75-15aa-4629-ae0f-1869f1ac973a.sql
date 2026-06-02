CREATE TABLE public.agent_personas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL DEFAULT current_clinic_id(),
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  channel text NOT NULL DEFAULT 'whatsapp',
  persona_text text,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  opening_message text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX agent_personas_clinic_idx ON public.agent_personas(clinic_id);
CREATE INDEX agent_personas_agent_idx ON public.agent_personas(agent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_personas TO authenticated;
GRANT ALL ON public.agent_personas TO service_role;

ALTER TABLE public.agent_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_personas_select ON public.agent_personas
  FOR SELECT
  USING (clinic_id = current_clinic_id() AND current_clinic_has_feature('agents'));

CREATE POLICY agent_personas_admin_write ON public.agent_personas
  FOR ALL
  USING (clinic_id = current_clinic_id() AND is_clinic_admin() AND current_clinic_has_feature('agents'))
  WITH CHECK (clinic_id = current_clinic_id() AND is_clinic_admin() AND current_clinic_has_feature('agents'));

CREATE TRIGGER update_agent_personas_updated_at
  BEFORE UPDATE ON public.agent_personas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
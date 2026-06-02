
CREATE TABLE public.agent_prompt_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL DEFAULT current_clinic_id(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  summary TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_prompt_versions_agent ON public.agent_prompt_versions(agent_id, created_at DESC);
CREATE INDEX idx_agent_prompt_versions_clinic ON public.agent_prompt_versions(clinic_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.agent_prompt_versions TO authenticated;
GRANT ALL ON public.agent_prompt_versions TO service_role;

ALTER TABLE public.agent_prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_versions_select"
ON public.agent_prompt_versions
FOR SELECT
TO authenticated
USING (clinic_id = current_clinic_id());

CREATE POLICY "prompt_versions_insert"
ON public.agent_prompt_versions
FOR INSERT
TO authenticated
WITH CHECK (clinic_id = current_clinic_id());

CREATE POLICY "prompt_versions_delete"
ON public.agent_prompt_versions
FOR DELETE
TO authenticated
USING (clinic_id = current_clinic_id());

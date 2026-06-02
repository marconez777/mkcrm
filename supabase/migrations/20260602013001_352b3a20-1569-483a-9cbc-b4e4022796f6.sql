CREATE TABLE public.ai_agent_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step int NOT NULL DEFAULT 1,
  niche text,
  niche_other text,
  goal text,
  goal_other text,
  provider text,
  api_key text,
  base_url text,
  model text,
  provider_verified_at timestamptz,
  interview_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_prompt text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_drafts TO authenticated;
GRANT ALL ON public.ai_agent_drafts TO service_role;

ALTER TABLE public.ai_agent_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see drafts in their clinic"
ON public.ai_agent_drafts FOR SELECT TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users insert own drafts in their clinic"
ON public.ai_agent_drafts FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND clinic_id IN (
    SELECT clinic_id FROM public.clinic_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users update own drafts"
ON public.ai_agent_drafts FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own drafts"
ON public.ai_agent_drafts FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.ai_agent_drafts_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_agent_drafts_updated
BEFORE UPDATE ON public.ai_agent_drafts
FOR EACH ROW EXECUTE FUNCTION public.ai_agent_drafts_touch_updated_at();


-- 1. silent flag in ai_agents
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS silent boolean NOT NULL DEFAULT false;

-- 2. watcher_agent_id in whatsapp_instances
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS watcher_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL;

-- 3. lead_stage_history
CREATE TABLE IF NOT EXISTS public.lead_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT current_clinic_id(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_stage_id uuid,
  to_stage_id uuid,
  moved_by_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  moved_by_user_id uuid,
  moved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead ON public.lead_stage_history(lead_id, moved_at DESC);

ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_scoped ON public.lead_stage_history;
CREATE POLICY clinic_scoped ON public.lead_stage_history
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());

-- Trigger to record stage changes
CREATE OR REPLACE FUNCTION public.record_lead_stage_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.lead_stage_history (clinic_id, lead_id, from_stage_id, to_stage_id, moved_by_user_id)
    VALUES (NEW.clinic_id, NEW.id, OLD.stage_id, NEW.stage_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_stage_history ON public.leads;
CREATE TRIGGER trg_lead_stage_history
  AFTER UPDATE OF stage_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.record_lead_stage_history();

-- 4. pending_replies: composite PK (lead_id, agent_id)
ALTER TABLE public.pending_replies
  ALTER COLUMN agent_id SET NOT NULL;

ALTER TABLE public.pending_replies DROP CONSTRAINT IF EXISTS pending_replies_pkey;
ALTER TABLE public.pending_replies ADD CONSTRAINT pending_replies_pkey PRIMARY KEY (lead_id, agent_id);

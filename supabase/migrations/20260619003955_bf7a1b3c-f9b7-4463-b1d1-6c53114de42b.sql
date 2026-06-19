-- Step 3: Schema drift fix for lead_ai_settings (agent-followups-tick)
ALTER TABLE public.lead_ai_settings
  ADD COLUMN IF NOT EXISTS current_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_followup_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_lead_ai_settings_current_stage ON public.lead_ai_settings(current_stage_id) WHERE current_stage_id IS NOT NULL;

-- Backfill current_stage_id and stage_entered_at from leads
UPDATE public.lead_ai_settings s
SET current_stage_id = l.stage_id,
    stage_entered_at = COALESCE(l.stage_changed_at, l.created_at)
FROM public.leads l
WHERE s.lead_id = l.id
  AND s.current_stage_id IS DISTINCT FROM l.stage_id
  AND l.stage_id IS NOT NULL;

-- Trigger to keep lead_ai_settings.current_stage_id in sync when lead stage changes
CREATE OR REPLACE FUNCTION public.sync_lead_ai_settings_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    UPDATE public.lead_ai_settings
       SET current_stage_id = NEW.stage_id,
           stage_entered_at = COALESCE(NEW.stage_changed_at, now())
     WHERE lead_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_ai_settings_stage ON public.leads;
CREATE TRIGGER trg_sync_lead_ai_settings_stage
AFTER UPDATE OF stage_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_ai_settings_stage();
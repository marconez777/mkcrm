ALTER TABLE public.agent_stages
  ADD COLUMN IF NOT EXISTS allowed_tools text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS follow_up_after_min integer,
  ADD COLUMN IF NOT EXISTS follow_up_message text,
  ADD COLUMN IF NOT EXISTS follow_up_tool_name text;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS stages_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.lead_ai_settings
  ADD COLUMN IF NOT EXISTS current_stage_id uuid REFERENCES public.agent_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_followup_at timestamptz;

CREATE INDEX IF NOT EXISTS lead_ai_settings_followup_idx
  ON public.lead_ai_settings(current_stage_id, stage_entered_at)
  WHERE current_stage_id IS NOT NULL;
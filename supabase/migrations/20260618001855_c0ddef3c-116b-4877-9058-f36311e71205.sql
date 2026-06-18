
DO $$ BEGIN PERFORM cron.unschedule('audio-tick-cron'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('stage-aging-tick-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Recreate lead_ai_settings (Inbox auto-reply per-lead config)
CREATE TABLE IF NOT EXISTS public.lead_ai_settings (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  auto_reply boolean NOT NULL DEFAULT false,
  paused_until timestamptz,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_ai_settings TO authenticated;
GRANT ALL ON public.lead_ai_settings TO service_role;
ALTER TABLE public.lead_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_ai_settings clinic scoped" ON public.lead_ai_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.clinic_id = current_clinic_id())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.clinic_id = current_clinic_id())
  );

-- Recreate stage_ai_defaults (Inbox auto-reply per-stage agent)
CREATE TABLE IF NOT EXISTS public.stage_ai_defaults (
  stage_id uuid PRIMARY KEY REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  auto_reply boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_ai_defaults TO authenticated;
GRANT ALL ON public.stage_ai_defaults TO service_role;
ALTER TABLE public.stage_ai_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stage_ai_defaults clinic scoped" ON public.stage_ai_defaults
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.pipeline_stages s WHERE s.id = stage_id AND s.clinic_id = current_clinic_id())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.pipeline_stages s WHERE s.id = stage_id AND s.clinic_id = current_clinic_id())
  );

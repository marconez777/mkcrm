
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL, -- 'no_reply_after' | 'stage_idle' | 'new_lead'
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb, -- { hours: 24, stage_id?: uuid }
  action_type text NOT NULL, -- 'ai_followup' | 'send_template' | 'move_stage'
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb, -- { agent_id?, prompt?, template?, stage_id? }
  cooldown_hours integer NOT NULL DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.automations FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER automations_set_updated_at BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'success', -- 'success' | 'error' | 'skipped'
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.automation_runs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_automation_runs_lead ON public.automation_runs(automation_id, lead_id, created_at DESC);
CREATE INDEX idx_automations_enabled ON public.automations(enabled) WHERE enabled = true;

-- Schedule the tick every 5 minutes
SELECT cron.schedule(
  'automations-tick-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/automations-tick',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);

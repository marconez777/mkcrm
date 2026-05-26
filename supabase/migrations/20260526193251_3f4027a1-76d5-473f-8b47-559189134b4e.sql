
CREATE TABLE public.scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT current_clinic_id(),
  name text NOT NULL DEFAULT 'Relatório diário',
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  group_jid text NOT NULL,
  group_name text,
  send_time text NOT NULL DEFAULT '20:00',
  tz text NOT NULL DEFAULT 'America/Sao_Paulo',
  weekdays int[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  metrics jsonb NOT NULL DEFAULT '{"unique_visitors":true,"whatsapp_clicks":true,"form_leads":true,"whatsapp_leads":true}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_reports TO authenticated;
GRANT ALL ON public.scheduled_reports TO service_role;

ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_scoped" ON public.scheduled_reports
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());

CREATE INDEX idx_scheduled_reports_clinic ON public.scheduled_reports(clinic_id);
CREATE INDEX idx_scheduled_reports_enabled ON public.scheduled_reports(enabled) WHERE enabled = true;

CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON public.scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.scheduled_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.scheduled_reports(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  status text NOT NULL,
  message_preview text,
  metrics jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.scheduled_report_runs TO authenticated;
GRANT ALL ON public.scheduled_report_runs TO service_role;

ALTER TABLE public.scheduled_report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_scoped" ON public.scheduled_report_runs
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());

CREATE INDEX idx_scheduled_report_runs_report ON public.scheduled_report_runs(report_id, created_at DESC);

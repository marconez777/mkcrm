
CREATE TABLE public.pipeline_tick_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  phase TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  ok BOOLEAN NOT NULL DEFAULT true,
  candidates INTEGER NOT NULL DEFAULT 0,
  moved INTEGER NOT NULL DEFAULT 0,
  not_moved INTEGER NOT NULL DEFAULT 0,
  skipped_no_dest INTEGER NOT NULL DEFAULT 0,
  errored INTEGER NOT NULL DEFAULT 0,
  avg_ms_per_lead INTEGER NOT NULL DEFAULT 0,
  p95_ms_per_lead INTEGER NOT NULL DEFAULT 0,
  failure_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  raw JSONB
);

CREATE INDEX pipeline_tick_stats_started_at_idx ON public.pipeline_tick_stats (started_at DESC);
CREATE INDEX pipeline_tick_stats_action_idx ON public.pipeline_tick_stats (action, started_at DESC);

GRANT SELECT ON public.pipeline_tick_stats TO authenticated;
GRANT ALL ON public.pipeline_tick_stats TO service_role;

ALTER TABLE public.pipeline_tick_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view tick stats"
  ON public.pipeline_tick_stats
  FOR SELECT
  USING (public.is_super_admin());

ALTER TABLE public.pipeline_tick_stats REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_tick_stats;


CREATE TABLE IF NOT EXISTS public.tag_usage_weekly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL,
  week_start date NOT NULL,
  emit_count integer NOT NULL DEFAULT 0,
  applied_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag, week_start)
);

GRANT SELECT ON public.tag_usage_weekly TO authenticated;
GRANT ALL ON public.tag_usage_weekly TO service_role;

ALTER TABLE public.tag_usage_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read tag_usage_weekly"
  ON public.tag_usage_weekly FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_tag_usage_weekly_week ON public.tag_usage_weekly(week_start DESC);

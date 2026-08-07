CREATE TABLE IF NOT EXISTS public.pipeline_provider_health (
  clinic_id uuid NOT NULL,
  provider text NOT NULL,
  blocked_until timestamptz NOT NULL,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, provider)
);

GRANT SELECT ON public.pipeline_provider_health TO authenticated;
GRANT ALL ON public.pipeline_provider_health TO service_role;

ALTER TABLE public.pipeline_provider_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin reads provider health"
  ON public.pipeline_provider_health
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_provider_health_blocked
  ON public.pipeline_provider_health (blocked_until);

COMMENT ON TABLE public.pipeline_provider_health IS
  'Marca provedores de IA bloqueados por quota/billing por clínica. Usada pelo auto-retry e alertas operacionais.';
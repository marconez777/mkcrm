-- G3: Registry de agentes de pipeline por tenant.
-- Fonte de verdade para o dispatcher central (G5) e para a UI por tenant (G6).
CREATE TABLE public.pipeline_tenant_classifiers (
  slug              text PRIMARY KEY,
  clinic_id         uuid NOT NULL UNIQUE,
  edge_function_name text NOT NULL,
  cron_enabled      boolean NOT NULL DEFAULT false,
  byok_required     boolean NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_tenant_classifiers_slug_format
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- Grants ANTES do RLS (padrão Data API).
GRANT SELECT ON public.pipeline_tenant_classifiers TO authenticated;
GRANT ALL    ON public.pipeline_tenant_classifiers TO service_role;

ALTER TABLE public.pipeline_tenant_classifiers ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário autenticado só vê a linha da própria clínica (via clinic_members).
CREATE POLICY "tenant_registry_read_own_clinic"
  ON public.pipeline_tenant_classifiers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.clinic_id = pipeline_tenant_classifiers.clinic_id
        AND cm.user_id   = auth.uid()
    )
  );

-- Escrita: apenas service_role (edge/admin). Nenhuma policy para authenticated.

-- updated_at automático.
CREATE OR REPLACE FUNCTION public.pipeline_tenant_classifiers_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pipeline_tenant_classifiers_updated_at
  BEFORE UPDATE ON public.pipeline_tenant_classifiers
  FOR EACH ROW EXECUTE FUNCTION public.pipeline_tenant_classifiers_set_updated_at();

-- Seed: Clínica ÓR (adoção retroativa — cron_enabled=false para não interferir
-- com o cron legado `pipeline-classify-tick` até G5 estar pronto).
INSERT INTO public.pipeline_tenant_classifiers
  (slug, clinic_id, edge_function_name, cron_enabled, byok_required, notes)
VALUES
  ('clinica-or',
   'cf038458-457d-4c1a-9ac4-c88c3c8353a1',
   'pipeline-classify',
   false,
   false,
   'Adoção retroativa. cron_enabled fica false até o dispatcher central (G5) substituir o cron legado pipeline-classify-tick.');

COMMENT ON TABLE public.pipeline_tenant_classifiers IS
  'G3 — Registry de agentes de pipeline por tenant. Lido pelo dispatcher central (G5) e pelo AIPipelinesCard (G6). Escrita só via service_role.';
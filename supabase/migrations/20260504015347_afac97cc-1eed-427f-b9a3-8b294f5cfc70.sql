-- 1. Tabela pipelines
CREATE TABLE public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'sales',
  color text NOT NULL DEFAULT '#6366f1',
  position integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  whatsapp_instance_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pipelines_kind_check CHECK (kind IN ('sales','internal'))
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON public.pipelines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_pipelines_updated
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. pipeline_id em pipeline_stages e leads
ALTER TABLE public.pipeline_stages ADD COLUMN pipeline_id uuid;
ALTER TABLE public.leads ADD COLUMN pipeline_id uuid;

-- 3. Pipeline default e backfill
DO $$
DECLARE
  v_pid uuid;
BEGIN
  INSERT INTO public.pipelines (name, kind, is_default, position)
  VALUES ('Vendas', 'sales', true, 0)
  RETURNING id INTO v_pid;

  UPDATE public.pipeline_stages SET pipeline_id = v_pid WHERE pipeline_id IS NULL;
  UPDATE public.leads l
     SET pipeline_id = v_pid
   WHERE pipeline_id IS NULL;
END $$;

-- 4. NOT NULL e FKs
ALTER TABLE public.pipeline_stages
  ALTER COLUMN pipeline_id SET NOT NULL,
  ADD CONSTRAINT pipeline_stages_pipeline_fk
    FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) ON DELETE CASCADE;

CREATE INDEX idx_pipeline_stages_pipeline ON public.pipeline_stages(pipeline_id, position);
CREATE INDEX idx_leads_pipeline ON public.leads(pipeline_id);

-- 5. Trigger: pipeline_id do lead segue a stage
CREATE OR REPLACE FUNCTION public.sync_lead_pipeline_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stage_id IS NOT NULL THEN
    SELECT pipeline_id INTO NEW.pipeline_id
    FROM public.pipeline_stages WHERE id = NEW.stage_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_sync_pipeline
  BEFORE INSERT OR UPDATE OF stage_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_lead_pipeline_id();

-- 6. Garantir um único pipeline default
CREATE UNIQUE INDEX uniq_pipeline_default ON public.pipelines(is_default) WHERE is_default;


-- Limpa vínculos inválidos
UPDATE public.pipelines SET whatsapp_instance_id = NULL WHERE kind = 'internal';

-- Garante 1 funil por instância dentro da mesma clínica
CREATE UNIQUE INDEX IF NOT EXISTS pipelines_one_per_instance
  ON public.pipelines (clinic_id, whatsapp_instance_id)
  WHERE whatsapp_instance_id IS NOT NULL;

-- Trigger: bloqueia vincular instância a funil interno
CREATE OR REPLACE FUNCTION public.enforce_pipeline_kind_instance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'internal' AND NEW.whatsapp_instance_id IS NOT NULL THEN
    NEW.whatsapp_instance_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pipeline_kind_instance ON public.pipelines;
CREATE TRIGGER trg_enforce_pipeline_kind_instance
BEFORE INSERT OR UPDATE ON public.pipelines
FOR EACH ROW EXECUTE FUNCTION public.enforce_pipeline_kind_instance();

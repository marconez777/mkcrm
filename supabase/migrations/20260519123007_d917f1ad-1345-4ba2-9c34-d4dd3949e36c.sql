-- 1) Colunas de sistema
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ai_agents_clinic_system_key_uidx
  ON public.ai_agents(clinic_id, system_key)
  WHERE system_key IS NOT NULL;

-- 2) Promove os 3 agentes da ÓR a templates oficiais
UPDATE public.ai_agents SET is_system = true, system_key = 'classifier'
  WHERE id = 'e2b20d28-416a-4a42-a580-ea080aff4ec0';
UPDATE public.ai_agents SET is_system = true, system_key = 'analyst'
  WHERE id = '79d3e3f1-54a5-40d0-99f1-66eee1509225';
UPDATE public.ai_agents SET is_system = true, system_key = 'summary'
  WHERE id = '5d0bb5ce-09da-4683-8c8a-eebae31373cb';

-- 3) Trigger anti-deleção
CREATE OR REPLACE FUNCTION public.prevent_system_agent_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_system = true THEN
    RAISE EXCEPTION 'system_agent_cannot_be_deleted'
      USING HINT = 'Agentes padrão do sistema só podem ser desativados, não excluídos.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS ai_agents_prevent_system_delete ON public.ai_agents;
CREATE TRIGGER ai_agents_prevent_system_delete
  BEFORE DELETE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_system_agent_delete();

-- 4) Função de seed
CREATE OR REPLACE FUNCTION public.seed_system_agents(_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_agents (
    clinic_id, name, system_prompt, model, provider, temperature,
    enabled, silent, role, description, tools, max_tool_calls,
    debounce_seconds, rag_top_k, planning_mode, use_memory,
    use_hybrid_search, use_hyde, max_iterations,
    is_system, system_key
  )
  SELECT
    _clinic_id, t.name, t.system_prompt, t.model, t.provider, t.temperature,
    false, t.silent, t.role, t.description, t.tools, t.max_tool_calls,
    t.debounce_seconds, t.rag_top_k, t.planning_mode, t.use_memory,
    t.use_hybrid_search, t.use_hyde, t.max_iterations,
    true, t.system_key
  FROM public.ai_agents t
  WHERE t.is_system = true
    AND t.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
    AND NOT EXISTS (
      SELECT 1 FROM public.ai_agents x
      WHERE x.clinic_id = _clinic_id AND x.system_key = t.system_key
    );
END $$;

-- 5) Propaga para todas as clínicas existentes
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id FROM public.clinics LOOP
    PERFORM public.seed_system_agents(c.id);
  END LOOP;
END $$;

-- 6) Trigger AFTER INSERT em clinics
CREATE OR REPLACE FUNCTION public.tg_seed_system_agents_on_clinic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_system_agents(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clinics_seed_system_agents ON public.clinics;
CREATE TRIGGER clinics_seed_system_agents
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_system_agents_on_clinic();
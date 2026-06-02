
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS draft_mode BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.log_ai_agent_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changes JSONB := '{}'::jsonb;
  field TEXT;
  watched TEXT[] := ARRAY[
    'system_prompt','model','provider','temperature','enabled','tools',
    'draft_mode','use_hyde','use_hybrid_search','use_memory','planning_mode',
    'rag_top_k','max_iterations','name','description'
  ];
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  FOREACH field IN ARRAY watched LOOP
    IF to_jsonb(OLD) -> field IS DISTINCT FROM to_jsonb(NEW) -> field THEN
      changes := changes || jsonb_build_object(
        field,
        jsonb_build_object(
          'from', to_jsonb(OLD) -> field,
          'to', to_jsonb(NEW) -> field
        )
      );
    END IF;
  END LOOP;
  IF changes <> '{}'::jsonb THEN
    INSERT INTO public.audit_log (clinic_id, actor_user_id, action, entity, entity_id, diff)
    VALUES (
      NEW.clinic_id,
      auth.uid(),
      'ai_agent.updated',
      'ai_agent',
      NEW.id::text,
      jsonb_build_object('name', NEW.name, 'changes', changes)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ai_agent_changes ON public.ai_agents;
CREATE TRIGGER trg_log_ai_agent_changes
AFTER UPDATE ON public.ai_agents
FOR EACH ROW EXECUTE FUNCTION public.log_ai_agent_changes();

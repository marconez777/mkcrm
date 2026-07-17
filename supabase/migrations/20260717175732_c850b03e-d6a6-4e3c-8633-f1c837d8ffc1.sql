-- =====================================================================
-- Trigger de Wake-up Automático para Clínica OR
-- Move o lead instantaneamente de volta para "Qualificação" caso
-- ele envie uma mensagem enquanto estiver nas colunas frias
-- (Sem Resposta, Nutrição Inativa ou Nutrição Antigos).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_clinica_or_wakeup_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead record;
  v_old_stage uuid;
  v_new_stage uuid := 'c6eb67f3-cba9-41e5-949c-aa12d34d962d'::uuid; -- ID de Qualificação
BEGIN
  -- 1. Só atua em mensagens que vêm DO paciente (inbound)
  IF NEW.from_me = true THEN
    RETURN NEW;
  END IF;

  -- 2. Busca o lead associado, filtrando estritamente para a Clínica OR
  SELECT id, clinic_id, pipeline_id, stage_id, tags
    INTO v_lead
    FROM public.leads
   WHERE id = NEW.lead_id
     AND clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'::uuid;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_old_stage := v_lead.stage_id;

  -- 3. Verifica se o lead está em uma das 3 "Geladeiras"
  IF v_old_stage IN (
    '9f408ae6-649e-44b2-bc56-f93d138c87ed'::uuid, -- Sem resposta
    '64356dbe-3889-4b49-9429-260501cdb3d8'::uuid, -- Nutrição Inativa
    '9de8e54e-7edb-47dd-b613-de22276d8ea1'::uuid  -- Nutrição Antigos
  ) THEN
    
    -- 4. Move o paciente para Qualificação e injeta a tag 'reativacao'
    UPDATE public.leads
       SET stage_id = v_new_stage,
           stage_changed_at = now(),
           updated_at = now(),
           tags = ARRAY(
             SELECT DISTINCT unnest(v_lead.tags || ARRAY['reativacao'])
           )
     WHERE id = v_lead.id;

    -- 5. Grava no Histórico do Lead para auditoria e UI
    INSERT INTO public.lead_stage_history (
      lead_id, 
      clinic_id, 
      pipeline_id, 
      "from", 
      "to", 
      reason, 
      source, 
      moved_at
    ) VALUES (
      v_lead.id, 
      v_lead.clinic_id, 
      v_lead.pipeline_id, 
      v_old_stage, 
      v_new_stage,
      'Paciente voltou a responder (Reativação automática)', 
      'auto:wakeup-trigger', 
      now()
    );

  END IF;

  RETURN NEW;
END;
$$;

-- Aplica o trigger na tabela de mensagens
DROP TRIGGER IF EXISTS trg_clinica_or_wakeup_inbound ON public.messages;

CREATE TRIGGER trg_clinica_or_wakeup_inbound
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_clinica_or_wakeup_inbound();

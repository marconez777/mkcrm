-- 1. Ajustar o tempo de Qualificação para "Sem Resposta" (no_reply_after) para 24 horas
UPDATE public.automations
SET trigger_config = jsonb_set(COALESCE(trigger_config, '{}'::jsonb), '{hours}', '24'::jsonb)
WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
  AND trigger_type = 'no_reply_after';

-- 2. Regra de inatividade: 60 Dias parado em Paciente Antigo -> Mover para Nutrição Antigos
-- clinic_id: 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
-- trigger_type: 'stage_idle'
-- stage_id origem: '7fea97d7-c2af-4e6f-8f39-af8375bb4468' (Paciente Antigo)
-- stage_id destino: '9de8e54e-7edb-47dd-b613-de22276d8ea1' (Nutrição Antigos)
-- hours: 1440 (60 dias * 24 horas)
INSERT INTO public.automations (
  clinic_id, 
  name, 
  trigger_type, 
  trigger_config, 
  action_type, 
  action_config, 
  cooldown_hours, 
  enabled
)
SELECT
  'cf038458-457d-4c1a-9ac4-c88c3c8353a1',
  'Geladeira - 60 Dias (Paciente Antigo -> Nutrição Antigos)',
  'stage_idle',
  '{"stage_ids": ["7fea97d7-c2af-4e6f-8f39-af8375bb4468"], "hours": 1440}'::jsonb,
  'move_stage',
  '{"stage_id": "9de8e54e-7edb-47dd-b613-de22276d8ea1"}'::jsonb,
  24,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.automations
  WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
    AND trigger_type = 'stage_idle'
    AND action_type = 'move_stage'
    AND trigger_config->'stage_ids' @> '["7fea97d7-c2af-4e6f-8f39-af8375bb4468"]'
);

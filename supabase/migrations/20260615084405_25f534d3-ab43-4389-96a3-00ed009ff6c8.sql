UPDATE public.pipeline_stages
SET lock_auto_move = true
WHERE id IN (
  'ab7ff652-2be8-48fe-9f4f-5c437f975b41', -- Lead não qualificado
  '500fc81f-a3bc-4fbd-ab33-08d0a8866134', -- Paciente antigo
  'd6de683c-d1bb-47e4-9a89-74af0bf7ea3c'  -- Nutrição de Leads Inativos
);
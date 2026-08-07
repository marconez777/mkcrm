-- PR4: canonical eh_paciente_antigo + remove modalidade_preferida (clínica ÓR)
-- Adiciona definição do campo canônico booleano usado pelo pipeline-deterministic
INSERT INTO public.lead_custom_fields (clinic_id, field_key, label, field_type, options, position)
VALUES (
  'cf038458-457d-4c1a-9ac4-c88c3c8353a1',
  'eh_paciente_antigo',
  'É paciente antigo?',
  'boolean',
  '[]'::jsonb,
  100
)
ON CONFLICT DO NOTHING;

-- Remove definição não usada
DELETE FROM public.lead_custom_fields
WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'
  AND field_key='modalidade_preferida';
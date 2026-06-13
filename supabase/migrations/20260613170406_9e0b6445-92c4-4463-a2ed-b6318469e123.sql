
-- 1) Novo campo "Data do procedimento" para a clínica
INSERT INTO public.lead_custom_fields (clinic_id, field_key, label, field_type, options, position)
SELECT 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'::uuid,
       'procedimento_agendado_em',
       'Data do procedimento',
       'datetime',
       NULL,
       COALESCE((SELECT MAX(position)+1 FROM public.lead_custom_fields WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'::uuid), 0)
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_custom_fields
  WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'::uuid AND field_key='procedimento_agendado_em'
);

-- 2) Regra: procedimento agendado em data futura -> Procedimento Agendado
INSERT INTO public.pipeline_field_rules
  (clinic_id, pipeline_id, target_stage_id, name, priority, enabled, conditions)
SELECT 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'::uuid,
       '737242e7-8efc-4a8f-9fed-f09c6e5dc227'::uuid,
       '1d592e90-1720-4406-9849-67ba8e27178c'::uuid,
       'Procedimento agendado',
       150,
       true,
       '[{"field":"procedimento_agendado_em","op":"not_empty"},{"field":"procedimento_agendado_em","op":"is_future"}]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_field_rules
  WHERE pipeline_id='737242e7-8efc-4a8f-9fed-f09c6e5dc227'::uuid AND name='Procedimento agendado'
);

-- 3) Backfill: leads em "Consulta Agendada" que claramente são procedimento (procedimentos contém cetamina/infusão/emt)
--    Migra a data e move pro stage Procedimento Agendado.
UPDATE public.leads
SET custom_fields = (custom_fields - 'consulta_agendada_em')
                    || jsonb_build_object('procedimento_agendado_em', custom_fields->'consulta_agendada_em'),
    stage_id = '1d592e90-1720-4406-9849-67ba8e27178c'::uuid
WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'::uuid
  AND stage_id = 'd1337eab-e229-4194-810f-c3fba9d2425f'::uuid -- Consulta Agendada
  AND custom_fields ? 'consulta_agendada_em'
  AND (custom_fields->>'consulta_agendada_em') IS NOT NULL
  AND custom_fields ? 'procedimentos'
  AND lower(custom_fields->>'procedimentos') ~ '(cetamina|infus|emt)';

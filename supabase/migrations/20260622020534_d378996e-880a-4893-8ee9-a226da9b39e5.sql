INSERT INTO public.stage_canonical_aliases (clinic_id, pipeline_id, stage_id, canonical_name)
VALUES
  ('cf038458-457d-4c1a-9ac4-c88c3c8353a1', '17c27f4d-8256-4ea7-b5b9-ed706494f686', '2a352661-01e2-41f8-be10-032f803e2387', '1ª Sessão Finalizada'),
  ('cf038458-457d-4c1a-9ac4-c88c3c8353a1', '17c27f4d-8256-4ea7-b5b9-ed706494f686', '9de8e54e-7edb-47dd-b613-de22276d8ea1', 'Nutrição Antigos')
ON CONFLICT DO NOTHING;
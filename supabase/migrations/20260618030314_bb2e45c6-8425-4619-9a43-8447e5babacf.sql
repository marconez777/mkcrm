
INSERT INTO public.app_settings (key, value, updated_at) VALUES
  ('automation.judicializacao.enabled',   'true', now()),
  ('automation.renovacao_receita.enabled','true', now()),
  ('automation.objection_suggest.enabled','true', now()),
  ('automation.stage_bindings.enabled',   'true', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

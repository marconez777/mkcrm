INSERT INTO public.app_settings (key, value) VALUES
  ('automation.ai_chat_move.enabled', '"true"'::jsonb),
  ('automation.ui_rule_move.enabled', '"true"'::jsonb),
  ('automation.inactivity_paciente_antigo.enabled', '"true"'::jsonb)
ON CONFLICT (key) DO NOTHING;
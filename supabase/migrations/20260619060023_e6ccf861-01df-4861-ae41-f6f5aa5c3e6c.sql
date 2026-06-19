UPDATE public.app_settings
SET value = 'true'
WHERE key IN (
  'automation.ai_chat_move.enabled',
  'automation.ui_rule_move.enabled',
  'automation.inactivity_paciente_antigo.enabled'
) AND value = '"true"';
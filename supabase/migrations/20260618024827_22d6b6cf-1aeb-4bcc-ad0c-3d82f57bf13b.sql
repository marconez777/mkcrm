UPDATE public.app_settings
SET value = 'true', updated_at = now()
WHERE key LIKE 'automation.%.enabled'
  AND value <> 'true';
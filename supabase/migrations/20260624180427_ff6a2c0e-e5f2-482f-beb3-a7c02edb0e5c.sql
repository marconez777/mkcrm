
INSERT INTO public.app_settings (key, value)
VALUES ('automation.appointment_sync.enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.app_settings (key, value)
VALUES ('automation.consulta_passou_finaliza.enabled', 'false'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

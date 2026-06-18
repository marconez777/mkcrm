-- Marco 2.5 — Auditores A1 (position-auditor) e A2 (post-move-verifier)
-- Toggles off-by-default + cron diário para o A1.

INSERT INTO public.app_settings (key, value) VALUES
  ('automation.position_auditor.enabled', 'false'),
  ('automation.position_auditor.batch_size', '50'),
  ('automation.post_move_verifier.enabled', 'false'),
  ('automation.post_move_verifier.rules_enabled', '[]')
ON CONFLICT (key) DO NOTHING;

-- Cron A1: 06:00 UTC = 03:00 BRT, diário.
SELECT cron.schedule(
  'pipeline-position-auditor-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/pipeline-position-auditor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"action":"tick"}'::jsonb
  );
  $$
);
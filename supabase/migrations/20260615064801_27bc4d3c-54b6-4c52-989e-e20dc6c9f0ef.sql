
SELECT cron.schedule(
  'dedup-leads-tick-daily',
  '30 7 * * *',  -- 04:30 BRT = 07:30 UTC
  $$
  SELECT net.http_post(
    url := 'https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/dedup-leads-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Adiciona job no pg_cron para invocar a edge function de auto-finalização da Clínica ÓR a cada 15 minutos.

SELECT cron.schedule(
    'invoke-pipeline-auto-finalize-or',
    '*/15 * * * *',
    $$
    select net.http_post(
        url:='https://' || current_setting('custom.project_ref', true) || '.supabase.co/functions/v1/pipeline-auto-finalize-or',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('custom.service_role_key', true) || '"}'::jsonb,
        body:='{}'::jsonb
    )
    $$
);

CREATE OR REPLACE FUNCTION public.notify_pipeline_deterministic(_action text, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  _url text := 'https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/pipeline-deterministic';
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ';
BEGIN
  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon,
      'apikey', _anon
    ),
    body := jsonb_build_object('action', _action) || _payload
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_pipeline_deterministic failed: %', SQLERRM;
END
$$;
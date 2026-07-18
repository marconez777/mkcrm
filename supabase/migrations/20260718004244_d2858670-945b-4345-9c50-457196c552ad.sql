CREATE OR REPLACE FUNCTION public.dispatch_pipeline_classifiers()
RETURNS TABLE(slug text, request_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  r          record;
  v_req_id   bigint;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ';
  v_url      text := 'https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/_template_pipeline_classify';
BEGIN
  FOR r IN
    SELECT ptc.clinic_id, ptc.classifier_version
    FROM public.pipeline_tenant_classifiers ptc
    WHERE ptc.enabled = true
    ORDER BY ptc.clinic_id
  LOOP
    BEGIN
      SELECT net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
                     'Content-Type',   'application/json',
                     'Authorization',  'Bearer ' || v_anon_key,
                     'apikey',         v_anon_key,
                     'x-dispatch-clinic', r.clinic_id::text
                   ),
        body    := jsonb_build_object(
                     'action',    'tick',
                     'source',    'pipeline-dispatcher',
                     'clinic_id', r.clinic_id,
                     'version',   coalesce(r.classifier_version, 'v1')
                   ),
        timeout_milliseconds := 60000
      ) INTO v_req_id;

      slug       := r.clinic_id::text;
      request_id := v_req_id;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'dispatch_pipeline_classifiers row error clinic=%: %', r.clinic_id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;
  RETURN;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dispatch_pipeline_classifiers fatal: %', SQLERRM;
  RETURN;
END;
$function$;
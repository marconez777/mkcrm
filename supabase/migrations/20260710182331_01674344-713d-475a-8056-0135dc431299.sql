-- G5 (retry): sem tentar UPDATE em cron.job (permission denied para o role da migration).
-- O cron nasce ativo mas fica no-op enquanto nenhum tenant tiver cron_enabled=true.

CREATE OR REPLACE FUNCTION public.dispatch_pipeline_classifiers()
RETURNS TABLE(slug text, request_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  r          record;
  v_url      text;
  v_req_id   bigint;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ';
  v_base_url text := 'https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/';
BEGIN
  FOR r IN
    SELECT ptc.slug, ptc.edge_function_name, ptc.clinic_id
    FROM public.pipeline_tenant_classifiers ptc
    WHERE ptc.cron_enabled = true
    ORDER BY ptc.slug
  LOOP
    v_url := v_base_url || r.edge_function_name;

    SELECT net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_anon_key,
                   'apikey',        v_anon_key,
                   'x-dispatch-slug', r.slug
                 ),
      body    := jsonb_build_object(
                   'action', 'tick',
                   'source', 'pipeline-dispatcher',
                   'slug',   r.slug
                 ),
      timeout_milliseconds := 60000
    ) INTO v_req_id;

    slug       := r.slug;
    request_id := v_req_id;
    RETURN NEXT;
  END LOOP;
  RETURN;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dispatch_pipeline_classifiers error: %', SQLERRM;
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dispatch_pipeline_classifiers() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dispatch_pipeline_classifiers() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.dispatch_pipeline_classifiers() TO service_role;

COMMENT ON FUNCTION public.dispatch_pipeline_classifiers() IS
  'G5 — Fan-out central de ticks para agentes de pipeline por tenant. Lê pipeline_tenant_classifiers WHERE cron_enabled=true e dispara HTTP não-bloqueante via pg_net. No-op quando não há tenants ativos.';

-- Agenda o cron se ainda não existir. Nasce ativo, mas no-op enquanto nenhum
-- tenant estiver com cron_enabled=true. Ativar/desativar tenants é um UPDATE
-- em pipeline_tenant_classifiers.cron_enabled.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pipeline-dispatcher-tick') THEN
    PERFORM cron.schedule(
      'pipeline-dispatcher-tick',
      '* * * * *',
      $cron$SELECT public.dispatch_pipeline_classifiers();$cron$
    );
  END IF;
END $$;
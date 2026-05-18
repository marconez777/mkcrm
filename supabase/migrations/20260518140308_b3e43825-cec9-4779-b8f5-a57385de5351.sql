
-- #1b: Defensive guard against silent clinic_id NULL inserts from service role
CREATE OR REPLACE FUNCTION public.assert_clinic_id_not_null()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id_required: tabela % exige clinic_id explicito (default current_clinic_id() retorna NULL em service role)', TG_TABLE_NAME
      USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agent_memory','agent_traces','ai_usage','lead_events','lead_tasks']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_assert_clinic_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_assert_clinic_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.assert_clinic_id_not_null()', t);
  END LOOP;
END $$;

-- #11: Aggregated daily view for /ai dashboard
CREATE OR REPLACE VIEW public.ai_usage_daily AS
SELECT
  clinic_id,
  agent_id,
  model,
  operation,
  date_trunc('day', created_at) AS day,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE status = 'error') AS errors,
  COALESCE(SUM(input_tokens), 0) AS input_tokens,
  COALESCE(SUM(output_tokens), 0) AS output_tokens,
  COALESCE(SUM(total_tokens), 0) AS total_tokens,
  COALESCE(SUM(cost_usd), 0) AS cost_usd,
  COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms
FROM public.ai_usage
GROUP BY 1,2,3,4,5;

GRANT SELECT ON public.ai_usage_daily TO authenticated;

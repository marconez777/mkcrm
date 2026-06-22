
-- G1: Views de telemetria do pipeline (admin-only)

-- 1) Maestro outcomes por dia
CREATE OR REPLACE VIEW public.v_maestro_outcomes_daily
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COALESCE(payload->'applied'->>'maestro_outcome', 'unknown') AS outcome,
  count(*)::bigint AS n
FROM public.lead_events
WHERE type = 'auto:classifier'
  AND created_at > now() - interval '30 days'
  AND public.is_super_admin()
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;

-- 2) Saúde do classifier por dia (latência, erros, custo)
CREATE OR REPLACE VIEW public.v_classify_health_daily
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', created_at)::date AS day,
  operation,
  count(*)::bigint AS calls,
  count(*) FILTER (WHERE error IS NOT NULL)::bigint AS errors,
  round(avg(latency_ms)::numeric, 0) AS latency_avg_ms,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)::int AS latency_p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS latency_p95_ms,
  round(sum(cost_usd)::numeric, 4) AS cost_usd
FROM public.ai_usage
WHERE operation LIKE 'classifier:%'
  AND created_at > now() - interval '30 days'
  AND public.is_super_admin()
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- 3) Custo de IA por dia x operação (todas as funções)
CREATE OR REPLACE VIEW public.v_ai_cost_daily
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', created_at)::date AS day,
  operation,
  count(*)::bigint AS calls,
  round(sum(cost_usd)::numeric, 4) AS cost_usd,
  sum(total_tokens)::bigint AS tokens
FROM public.ai_usage
WHERE created_at > now() - interval '30 days'
  AND public.is_super_admin()
GROUP BY 1, 2
ORDER BY 1 DESC, 4 DESC;

GRANT SELECT ON public.v_maestro_outcomes_daily TO authenticated;
GRANT SELECT ON public.v_classify_health_daily TO authenticated;
GRANT SELECT ON public.v_ai_cost_daily TO authenticated;
GRANT SELECT ON public.v_maestro_outcomes_daily TO service_role;
GRANT SELECT ON public.v_classify_health_daily TO service_role;
GRANT SELECT ON public.v_ai_cost_daily TO service_role;

COMMENT ON VIEW public.v_maestro_outcomes_daily IS 'G1: maestro_outcome (applied/strict_blocked/low_confidence/...) por dia, 30d. Filtro embutido is_super_admin().';
COMMENT ON VIEW public.v_classify_health_daily IS 'G1: latência p50/p95, erros e custo do classifier por dia. Filtro embutido is_super_admin().';
COMMENT ON VIEW public.v_ai_cost_daily IS 'G1: custo IA agregado por operação por dia, 30d. Filtro embutido is_super_admin().';

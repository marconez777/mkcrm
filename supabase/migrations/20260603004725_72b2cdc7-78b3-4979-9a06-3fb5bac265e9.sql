CREATE OR REPLACE FUNCTION public.admin_daily_metrics(_days int DEFAULT 30)
RETURNS TABLE(day date, messages bigint, leads bigint, ai_cost_usd numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      (current_date - (_days - 1))::date,
      current_date,
      interval '1 day'
    )::date AS day
  )
  SELECT
    d.day,
    COALESCE((SELECT count(*) FROM public.messages m WHERE m.created_at::date = d.day), 0)::bigint AS messages,
    COALESCE((SELECT count(*) FROM public.leads l WHERE l.created_at::date = d.day), 0)::bigint AS leads,
    COALESCE((SELECT sum(cost_usd) FROM public.ai_usage a WHERE a.created_at::date = d.day), 0)::numeric AS ai_cost_usd
  FROM days d
  ORDER BY d.day;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_daily_metrics(int) TO authenticated;
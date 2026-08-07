CREATE OR REPLACE FUNCTION public.admin_pipeline_errors_paginated(
  p_since_hours integer DEFAULT 168,
  p_step text DEFAULT NULL::text,
  p_clinic_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total int;
  v_rows jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH latest_err AS (
    SELECT DISTINCT ON (pri.lead_id)
      pri.lead_id, pri.clinic_id, pri.step, pri.error, pri.run_id,
      pri.created_at, pri.stage_name,
      pri.auto_retry_count, pri.auto_retry_pending, pri.result
    FROM pipeline_run_items pri
    WHERE pri.status = 'error'
      AND pri.lead_id IS NOT NULL
      AND pri.created_at > now() - make_interval(hours => p_since_hours)
      AND (p_step IS NULL OR pri.step = p_step)
      AND (p_clinic_id IS NULL OR pri.clinic_id = p_clinic_id)
    ORDER BY pri.lead_id, pri.created_at DESC
  )
  SELECT count(*) INTO v_total FROM latest_err;

  WITH latest_err AS (
    SELECT DISTINCT ON (pri.lead_id)
      pri.lead_id, pri.clinic_id, pri.step, pri.error, pri.run_id,
      pri.created_at, pri.stage_name,
      pri.auto_retry_count, pri.auto_retry_pending, pri.result
    FROM pipeline_run_items pri
    WHERE pri.status = 'error'
      AND pri.lead_id IS NOT NULL
      AND pri.created_at > now() - make_interval(hours => p_since_hours)
      AND (p_step IS NULL OR pri.step = p_step)
      AND (p_clinic_id IS NULL OR pri.clinic_id = p_clinic_id)
    ORDER BY pri.lead_id, pri.created_at DESC
  ),
  last_ok AS (
    SELECT DISTINCT ON (pri.lead_id)
      pri.lead_id,
      pri.result->'agents'->>'provider' AS last_provider
    FROM pipeline_run_items pri
    WHERE pri.lead_id IN (SELECT lead_id FROM latest_err)
      AND pri.status = 'ok'
      AND pri.result IS NOT NULL
    ORDER BY pri.lead_id, pri.created_at DESC
  ),
  blocked AS (
    SELECT clinic_id, array_agg(provider) AS providers
    FROM pipeline_provider_health
    WHERE blocked_until > now()
      AND clinic_id IN (SELECT clinic_id FROM latest_err)
    GROUP BY clinic_id
  )
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) INTO v_rows
  FROM (
    SELECT
      le.lead_id, le.clinic_id, le.step, le.error, le.run_id,
      le.created_at, le.stage_name,
      le.auto_retry_count, le.auto_retry_pending,
      l.name AS lead_name, l.phone AS lead_phone,
      c.name AS clinic_name,
      COALESCE(b.providers, ARRAY[]::text[]) AS provider_blocked,
      lo.last_provider
    FROM latest_err le
    LEFT JOIN leads l ON l.id = le.lead_id
    LEFT JOIN clinics c ON c.id = le.clinic_id
    LEFT JOIN blocked b ON b.clinic_id = le.clinic_id
    LEFT JOIN last_ok lo ON lo.lead_id = le.lead_id
    ORDER BY le.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) x;

  RETURN jsonb_build_object('total', COALESCE(v_total, 0), 'rows', COALESCE(v_rows, '[]'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_g10_expired()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  WITH upd AS (
    UPDATE public.leads l
    SET custom_fields_last_human_edit = COALESCE((
      SELECT jsonb_object_agg(k, v)
      FROM jsonb_each(l.custom_fields_last_human_edit) e(k, v)
      WHERE (v #>> '{}')::timestamptz > now() - interval '14 days'
    ), '{}'::jsonb)
    WHERE l.custom_fields_last_human_edit IS NOT NULL
      AND l.custom_fields_last_human_edit <> '{}'::jsonb
      AND EXISTS (
        SELECT 1
        FROM jsonb_each(l.custom_fields_last_human_edit) e(k, v)
        WHERE (v #>> '{}')::timestamptz <= now() - interval '14 days'
      )
    RETURNING 1
  )
  SELECT count(*) INTO updated_count FROM upd;
  RETURN updated_count;
END;
$$;

SELECT cron.schedule(
  'cleanup-g10-expired-daily',
  '0 4 * * *',
  $$ SELECT public.cleanup_g10_expired(); $$
);

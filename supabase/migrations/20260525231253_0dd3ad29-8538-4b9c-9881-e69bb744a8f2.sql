
-- Tabela agregada de métricas diárias de email
CREATE TABLE IF NOT EXISTS public.email_metrics_daily (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  day date NOT NULL,
  template_slug text NOT NULL DEFAULT '',
  sent integer NOT NULL DEFAULT 0,
  delivered integer NOT NULL DEFAULT 0,
  opened integer NOT NULL DEFAULT 0,
  clicked integer NOT NULL DEFAULT 0,
  bounced integer NOT NULL DEFAULT 0,
  complained integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, day, template_slug)
);

CREATE INDEX IF NOT EXISTS email_metrics_daily_clinic_day_idx
  ON public.email_metrics_daily (clinic_id, day DESC);

ALTER TABLE public.email_metrics_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_metrics_daily_read" ON public.email_metrics_daily;
CREATE POLICY "email_metrics_daily_read"
  ON public.email_metrics_daily
  FOR SELECT
  TO authenticated
  USING (
    has_clinic_access(clinic_id)
    AND clinic_has_feature(clinic_id, 'email_marketing')
  );

-- Função de refresh: recalcula últimos N dias (default 35)
CREATE OR REPLACE FUNCTION public.refresh_email_metrics_daily(_days integer DEFAULT 35)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
  cutoff timestamptz := now() - make_interval(days => greatest(_days, 1));
BEGIN
  WITH agg AS (
    SELECT
      clinic_id,
      (sent_at AT TIME ZONE 'UTC')::date AS day,
      COALESCE(template_slug, '') AS template_slug,
      count(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked','bounced','complained'))::int AS sent,
      count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
      count(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
      count(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked,
      count(*) FILTER (WHERE bounced_at IS NOT NULL)::int AS bounced,
      count(*) FILTER (WHERE complained_at IS NOT NULL)::int AS complained,
      count(*) FILTER (WHERE status = 'failed')::int AS failed
    FROM public.email_logs
    WHERE sent_at >= cutoff
    GROUP BY 1,2,3
  ),
  upsert AS (
    INSERT INTO public.email_metrics_daily
      (clinic_id, day, template_slug, sent, delivered, opened, clicked, bounced, complained, failed, updated_at)
    SELECT clinic_id, day, template_slug, sent, delivered, opened, clicked, bounced, complained, failed, now()
    FROM agg
    ON CONFLICT (clinic_id, day, template_slug) DO UPDATE
      SET sent = EXCLUDED.sent,
          delivered = EXCLUDED.delivered,
          opened = EXCLUDED.opened,
          clicked = EXCLUDED.clicked,
          bounced = EXCLUDED.bounced,
          complained = EXCLUDED.complained,
          failed = EXCLUDED.failed,
          updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO affected FROM upsert;

  RETURN COALESCE(affected, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_email_metrics_daily(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_email_metrics_daily(integer) TO service_role;

-- Agendamento: a cada 15 minutos
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'refresh-email-metrics-daily';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
  PERFORM cron.schedule(
    'refresh-email-metrics-daily',
    '*/15 * * * *',
    $cron$SELECT public.refresh_email_metrics_daily(35);$cron$
  );
END;
$$;

-- Primeiro refresh imediato (90 dias) para popular histórico
SELECT public.refresh_email_metrics_daily(90);

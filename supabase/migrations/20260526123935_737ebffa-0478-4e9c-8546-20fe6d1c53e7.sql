
-- R-17: Métricas em tempo real (throughput + alertas operacionais)

-- 1. View de throughput em tempo real
CREATE OR REPLACE VIEW public.email_throughput_stats AS
WITH queue_stats AS (
  SELECT
    clinic_id,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
    COUNT(*) FILTER (WHERE status = 'sent') AS sent_today,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_today,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_today,
    MIN(scheduled_at) FILTER (WHERE status = 'pending') AS oldest_pending_at,
    MAX(scheduled_at) FILTER (WHERE status = 'pending') AS newest_pending_at
  FROM public.email_queue
  WHERE created_at >= DATE_TRUNC('day', now())
  GROUP BY clinic_id
),
log_stats AS (
  SELECT
    clinic_id,
    COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= DATE_TRUNC('day', now())) AS sent_today_logs,
    COUNT(*) FILTER (WHERE status = 'bounced' AND bounced_at >= DATE_TRUNC('day', now())) AS bounced_today,
    COUNT(*) FILTER (WHERE status = 'complained' AND complained_at >= DATE_TRUNC('day', now())) AS complained_today,
    COUNT(*) FILTER (WHERE opened_at >= DATE_TRUNC('day', now())) AS opened_today,
    COUNT(*) FILTER (WHERE clicked_at >= DATE_TRUNC('day', now())) AS clicked_today
  FROM public.email_logs
  WHERE created_at >= DATE_TRUNC('day', now())
  GROUP BY clinic_id
)
SELECT
  COALESCE(q.clinic_id, l.clinic_id) AS clinic_id,
  COALESCE(q.pending_count, 0) AS pending_count,
  COALESCE(q.processing_count, 0) AS processing_count,
  COALESCE(q.sent_today, 0) + COALESCE(l.sent_today_logs, 0) AS sent_today,
  COALESCE(q.failed_today, 0) AS failed_today,
  COALESCE(q.cancelled_today, 0) AS cancelled_today,
  COALESCE(l.bounced_today, 0) AS bounced_today,
  COALESCE(l.complained_today, 0) AS complained_today,
  COALESCE(l.opened_today, 0) AS opened_today,
  COALESCE(l.clicked_today, 0) AS clicked_today,
  CASE
    WHEN (COALESCE(l.sent_today_logs, 0) + COALESCE(q.sent_today, 0)) > 0
    THEN ROUND((COALESCE(l.bounced_today, 0)::numeric / (COALESCE(l.sent_today_logs, 0) + COALESCE(q.sent_today, 0))::numeric) * 100, 2)
    ELSE 0
  END AS bounce_rate_pct,
  CASE
    WHEN (COALESCE(l.sent_today_logs, 0) + COALESCE(q.sent_today, 0)) > 0
    THEN ROUND((COALESCE(l.complained_today, 0)::numeric / (COALESCE(l.sent_today_logs, 0) + COALESCE(q.sent_today, 0))::numeric) * 100, 2)
    ELSE 0
  END AS complaint_rate_pct,
  q.oldest_pending_at,
  q.newest_pending_at,
  now() AS computed_at
FROM queue_stats q
FULL OUTER JOIN log_stats l ON q.clinic_id = l.clinic_id;

-- 2. Tabela de alertas operacionais
CREATE TABLE IF NOT EXISTS public.email_operational_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'queue_backlog',
    'low_throughput',
    'high_failure_rate',
    'stuck_processing',
    'domain_warmup_limit',
    'recipient_throttle_limit'
  )),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  metric_value NUMERIC,
  threshold NUMERIC,
  context JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_op_alerts_clinic_active
  ON public.email_operational_alerts(clinic_id, created_at)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_op_alerts_type
  ON public.email_operational_alerts(alert_type, created_at DESC);

-- 3. Função de health check operacional
CREATE OR REPLACE FUNCTION public.check_email_operational_health()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  pending_total INTEGER;
  processing_stuck INTEGER;
  failure_rate NUMERIC;
BEGIN
  SELECT COUNT(*) INTO pending_total FROM public.email_queue WHERE status = 'pending';
  IF pending_total > 500 THEN
    INSERT INTO public.email_operational_alerts (
      alert_type, severity, message, metric_value, threshold
    ) VALUES (
      'queue_backlog', 'warning',
      'Fila de email com backlog significativo',
      pending_total, 500
    )
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT COUNT(*) INTO processing_stuck
  FROM public.email_queue
  WHERE status = 'processing' AND updated_at < now() - interval '10 minutes';
  IF processing_stuck > 0 THEN
    INSERT INTO public.email_operational_alerts (
      alert_type, severity, message, metric_value, threshold
    ) VALUES (
      'stuck_processing', 'warning',
      'Jobs presos em processing por mais de 10 minutos',
      processing_stuck, 0
    )
    ON CONFLICT DO NOTHING;
  END IF;

  FOR r IN
    SELECT
      clinic_id,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
      COUNT(*) AS total_count
    FROM public.email_logs
    WHERE created_at >= now() - interval '24 hours'
    GROUP BY clinic_id
    HAVING COUNT(*) >= 100
  LOOP
    failure_rate := (r.failed_count::numeric / NULLIF(r.total_count, 0)::numeric) * 100;
    IF failure_rate > 10 THEN
      INSERT INTO public.email_operational_alerts (
        clinic_id, alert_type, severity, message, metric_value, threshold, context
      ) VALUES (
        r.clinic_id, 'high_failure_rate', 'critical',
        'Taxa de falha de envio muito alta nas ultimas 24h',
        failure_rate, 10,
        jsonb_build_object('failed', r.failed_count, 'total', r.total_count)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- 4. Trigger para health check
CREATE OR REPLACE FUNCTION public.email_queue_health_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.check_email_operational_health()
    FROM public.email_queue
    WHERE status = 'pending'
    HAVING COUNT(*) % 100 = 0;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS email_queue_health_trigger ON public.email_queue;
CREATE TRIGGER email_queue_health_trigger
  AFTER INSERT ON public.email_queue
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.email_queue_health_trigger_fn();

-- 5. View de resumo global
CREATE OR REPLACE VIEW public.email_system_health AS
SELECT
  (SELECT COUNT(*) FROM public.email_queue WHERE status = 'pending') AS global_pending,
  (SELECT COUNT(*) FROM public.email_queue WHERE status = 'processing') AS global_processing,
  (SELECT COUNT(*) FROM public.email_queue WHERE status = 'processing' AND updated_at < now() - interval '10 minutes') AS global_stuck,
  (SELECT COUNT(*) FROM public.email_logs WHERE created_at >= DATE_TRUNC('day', now()) AND status = 'sent') AS global_sent_today,
  (SELECT COUNT(*) FROM public.email_logs WHERE created_at >= DATE_TRUNC('day', now()) AND status = 'failed') AS global_failed_today,
  (SELECT COUNT(*) FROM public.email_operational_alerts WHERE resolved_at IS NULL) AS active_alerts,
  (SELECT COUNT(*) FROM public.email_health_alerts WHERE created_at >= now() - interval '24 hours') AS health_alerts_24h,
  now() AS computed_at;

-- RLS policies
ALTER TABLE public.email_operational_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all operational alerts"
  ON public.email_operational_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::app_role
    )
  );

CREATE POLICY "Admins can resolve operational alerts"
  ON public.email_operational_alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::app_role
    )
  );

CREATE POLICY "Clinic members can view their alerts"
  ON public.email_operational_alerts FOR SELECT
  TO authenticated
  USING (
    clinic_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid() AND cm.clinic_id = email_operational_alerts.clinic_id
    )
  );


-- =============================================================
-- AI Spend Limits per Clinic
-- =============================================================

-- Helper: which is_clinic_admin signature exists? use is_clinic_admin() (already in use across project)

-- 1. Main config table
CREATE TABLE IF NOT EXISTS public.ai_spend_limits (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  daily_limit_usd numeric(10,4) NOT NULL DEFAULT 2.00,
  block_on_limit boolean NOT NULL DEFAULT true,
  notify_emails text[] NOT NULL DEFAULT '{}',
  notify_thresholds int[] NOT NULL DEFAULT '{50,90,100}',
  blocked boolean NOT NULL DEFAULT false,
  blocked_at timestamptz,
  blocked_reason text,
  manual_override_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_spend_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_spend_limits_select"
ON public.ai_spend_limits FOR SELECT
TO authenticated
USING (is_super_admin() OR clinic_id = current_clinic_id());

CREATE POLICY "ai_spend_limits_admin_write"
ON public.ai_spend_limits FOR ALL
TO authenticated
USING (is_super_admin() OR (clinic_id = current_clinic_id() AND is_clinic_admin()))
WITH CHECK (is_super_admin() OR (clinic_id = current_clinic_id() AND is_clinic_admin()));

-- 2. Events / history
CREATE TABLE IF NOT EXISTS public.ai_spend_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('threshold_50','threshold_90','threshold_100','blocked','reactivated','auto_reset','notify_sent','notify_failed')),
  spent_usd numeric(12,6),
  limit_usd numeric(10,4),
  actor_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_spend_events_clinic ON public.ai_spend_events(clinic_id, created_at DESC);

ALTER TABLE public.ai_spend_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_spend_events_select"
ON public.ai_spend_events FOR SELECT
TO authenticated
USING (is_super_admin() OR clinic_id = current_clinic_id());

-- 3. Idempotency table (1 notification per threshold per day per clinic)
CREATE TABLE IF NOT EXISTS public.ai_spend_notifications_sent (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  notify_date date NOT NULL,
  threshold int NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, notify_date, threshold)
);

ALTER TABLE public.ai_spend_notifications_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_spend_notifications_select"
ON public.ai_spend_notifications_sent FOR SELECT
TO authenticated
USING (is_super_admin() OR clinic_id = current_clinic_id());

-- =============================================================
-- updated_at trigger
-- =============================================================
CREATE OR REPLACE FUNCTION public.touch_ai_spend_limits_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_spend_limits_updated_at ON public.ai_spend_limits;
CREATE TRIGGER trg_ai_spend_limits_updated_at
BEFORE UPDATE ON public.ai_spend_limits
FOR EACH ROW EXECUTE FUNCTION public.touch_ai_spend_limits_updated_at();

-- =============================================================
-- check_ai_spend_status: returns whether clinic can still spend today
-- =============================================================
CREATE OR REPLACE FUNCTION public.check_ai_spend_status(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit numeric;
  v_block_on_limit boolean;
  v_blocked boolean;
  v_override_until timestamptz;
  v_spent numeric;
  v_percent numeric;
  v_allowed boolean;
  v_day_start timestamptz;
BEGIN
  -- Day boundary in America/Sao_Paulo
  v_day_start := date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';

  SELECT daily_limit_usd, block_on_limit, blocked, manual_override_until
    INTO v_limit, v_block_on_limit, v_blocked, v_override_until
  FROM public.ai_spend_limits WHERE clinic_id = p_clinic_id;

  IF NOT FOUND THEN
    -- No config = no limit enforced
    RETURN jsonb_build_object(
      'allowed', true,
      'blocked', false,
      'spent_today_usd', 0,
      'limit_usd', null,
      'percent', 0,
      'configured', false
    );
  END IF;

  SELECT COALESCE(SUM(cost_usd), 0)
    INTO v_spent
  FROM public.ai_usage
  WHERE clinic_id = p_clinic_id
    AND created_at >= v_day_start
    AND cost_usd IS NOT NULL;

  v_percent := CASE WHEN v_limit > 0 THEN (v_spent / v_limit) * 100 ELSE 0 END;

  v_allowed := true;
  IF v_block_on_limit THEN
    IF v_blocked THEN
      -- Honor manual override window
      IF v_override_until IS NOT NULL AND v_override_until > now() THEN
        v_allowed := true;
      ELSE
        v_allowed := false;
      END IF;
    ELSIF v_spent >= v_limit AND v_limit > 0 THEN
      v_allowed := false;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'blocked', v_blocked,
    'spent_today_usd', v_spent,
    'limit_usd', v_limit,
    'percent', v_percent,
    'configured', true,
    'override_until', v_override_until
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_ai_spend_status(uuid) TO authenticated, service_role;

-- =============================================================
-- reactivate_ai_spend: admin clears the block manually
-- =============================================================
CREATE OR REPLACE FUNCTION public.reactivate_ai_spend(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorized boolean := false;
BEGIN
  v_authorized := is_super_admin() OR (p_clinic_id = current_clinic_id() AND is_clinic_admin());
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.ai_spend_limits
    SET blocked = false,
        blocked_at = null,
        blocked_reason = null,
        manual_override_until = now() + interval '15 minutes'
  WHERE clinic_id = p_clinic_id;

  INSERT INTO public.ai_spend_events (clinic_id, kind, actor_user_id, notes)
  VALUES (p_clinic_id, 'reactivated', auth.uid(), 'Reativação manual via painel');

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivate_ai_spend(uuid) TO authenticated;

-- =============================================================
-- Trigger: after insert on ai_usage -> evaluate thresholds + block
-- =============================================================
CREATE OR REPLACE FUNCTION public.ai_usage_spend_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cfg record;
  v_day_start timestamptz;
  v_spent numeric;
  v_percent numeric;
  v_today date;
  v_threshold int;
  v_url text;
  v_anon text;
  v_payload jsonb;
BEGIN
  IF NEW.cost_usd IS NULL OR NEW.clinic_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_cfg FROM public.ai_spend_limits WHERE clinic_id = NEW.clinic_id;
  IF NOT FOUND OR v_cfg.daily_limit_usd IS NULL OR v_cfg.daily_limit_usd <= 0 THEN
    RETURN NEW;
  END IF;

  v_day_start := date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
  v_today := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT COALESCE(SUM(cost_usd), 0) INTO v_spent
  FROM public.ai_usage
  WHERE clinic_id = NEW.clinic_id
    AND created_at >= v_day_start
    AND cost_usd IS NOT NULL;

  v_percent := (v_spent / v_cfg.daily_limit_usd) * 100;

  -- Get function URL + anon key for pg_net call
  SELECT value INTO v_url FROM public.app_settings WHERE key = 'supabase_url' LIMIT 1;
  IF v_url IS NULL THEN
    v_url := 'https://hrbhmqckzjxjbhpzpqeo.supabase.co';
  END IF;
  v_anon := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ';

  -- Evaluate each configured threshold (only fire each once per day)
  FOREACH v_threshold IN ARRAY v_cfg.notify_thresholds LOOP
    IF v_percent >= v_threshold THEN
      -- Try to claim the notification slot atomically
      INSERT INTO public.ai_spend_notifications_sent (clinic_id, notify_date, threshold)
      VALUES (NEW.clinic_id, v_today, v_threshold)
      ON CONFLICT DO NOTHING;

      IF FOUND THEN
        -- We just claimed it -> log event + dispatch email
        INSERT INTO public.ai_spend_events (clinic_id, kind, spent_usd, limit_usd)
        VALUES (
          NEW.clinic_id,
          CASE v_threshold
            WHEN 50 THEN 'threshold_50'
            WHEN 90 THEN 'threshold_90'
            WHEN 100 THEN 'threshold_100'
            ELSE 'notify_sent'
          END,
          v_spent, v_cfg.daily_limit_usd
        );

        v_payload := jsonb_build_object(
          'clinic_id', NEW.clinic_id,
          'threshold', v_threshold,
          'spent_usd', v_spent,
          'limit_usd', v_cfg.daily_limit_usd
        );

        BEGIN
          PERFORM net.http_post(
            url := v_url || '/functions/v1/ai-spend-notify',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'apikey', v_anon,
              'Authorization', 'Bearer ' || v_anon
            ),
            body := v_payload
          );
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO public.ai_spend_events (clinic_id, kind, notes)
          VALUES (NEW.clinic_id, 'notify_failed', SQLERRM);
        END;
      END IF;
    END IF;
  END LOOP;

  -- Auto-block if spent >= limit
  IF v_cfg.block_on_limit AND NOT v_cfg.blocked AND v_spent >= v_cfg.daily_limit_usd THEN
    UPDATE public.ai_spend_limits
      SET blocked = true,
          blocked_at = now(),
          blocked_reason = 'daily_limit_reached',
          manual_override_until = null
    WHERE clinic_id = NEW.clinic_id;

    INSERT INTO public.ai_spend_events (clinic_id, kind, spent_usd, limit_usd, notes)
    VALUES (NEW.clinic_id, 'blocked', v_spent, v_cfg.daily_limit_usd, 'Limite diário atingido — bloqueio automático');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never break ai_usage inserts because of guard failure
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_usage_spend_guard ON public.ai_usage;
CREATE TRIGGER trg_ai_usage_spend_guard
AFTER INSERT ON public.ai_usage
FOR EACH ROW EXECUTE FUNCTION public.ai_usage_spend_guard();

-- =============================================================
-- Daily reset (03:05 UTC == 00:05 America/Sao_Paulo)
-- =============================================================
DO $$
DECLARE
  v_existing_jobid bigint;
BEGIN
  SELECT jobid INTO v_existing_jobid FROM cron.job WHERE jobname = 'ai-spend-daily-reset';
  IF v_existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_jobid);
  END IF;

  PERFORM cron.schedule(
    'ai-spend-daily-reset',
    '5 3 * * *',
    $cron$
      WITH unblocked AS (
        UPDATE public.ai_spend_limits
          SET blocked = false,
              blocked_at = null,
              blocked_reason = null,
              manual_override_until = null
        WHERE blocked = true
        RETURNING clinic_id
      )
      INSERT INTO public.ai_spend_events (clinic_id, kind, notes)
      SELECT clinic_id, 'auto_reset', 'Reset diário automático'
      FROM unblocked;
    $cron$
  );
END $$;

-- =============================================================
-- Seed configuration for existing clinics
-- =============================================================
INSERT INTO public.ai_spend_limits (clinic_id, daily_limit_usd, notify_emails, notify_thresholds)
SELECT id, 2.00, ARRAY['contato@mkart.com.br']::text[], ARRAY[50,90,100]::int[]
FROM public.clinics
WHERE name IN ('ÓR','MKart')
ON CONFLICT (clinic_id) DO NOTHING;

INSERT INTO public.ai_spend_limits (clinic_id, daily_limit_usd, notify_emails, notify_thresholds)
SELECT id, 2.00, ARRAY[]::text[], ARRAY[50,90,100]::int[]
FROM public.clinics
WHERE name = 'Sanapta'
ON CONFLICT (clinic_id) DO NOTHING;

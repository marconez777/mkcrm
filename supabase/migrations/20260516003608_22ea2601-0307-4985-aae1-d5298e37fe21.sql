
-- ============================================================
-- Email Marketing multi-tenant
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 1. Tabela global de settings (HMAC, service role key)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_super_admin ON public.app_settings;
CREATE POLICY app_settings_super_admin ON public.app_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

INSERT INTO public.app_settings (key, value)
VALUES ('unsubscribe_hmac_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- placeholder (será preenchido pelo super admin via Integrações)
INSERT INTO public.app_settings (key, value)
VALUES ('cron_service_role_key', 'PLACEHOLDER')
ON CONFLICT (key) DO NOTHING;

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. email_domains (super admin gerencia; clínica visualiza)
-- ============================================================
CREATE TABLE public.email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  resend_domain_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|verifying|verified|failed
  region TEXT NOT NULL DEFAULT 'us-east-1',
  dns_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, domain)
);
CREATE INDEX email_domains_clinic_idx ON public.email_domains (clinic_id);

ALTER TABLE public.email_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_domains_select ON public.email_domains;
CREATE POLICY email_domains_select ON public.email_domains
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.has_clinic_access(clinic_id));

DROP POLICY IF EXISTS email_domains_super_admin_write ON public.email_domains;
CREATE POLICY email_domains_super_admin_write ON public.email_domains
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_email_domains_updated_at
  BEFORE UPDATE ON public.email_domains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. email_template_folders
-- ============================================================
CREATE TABLE public.email_template_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_template_folders_clinic_idx ON public.email_template_folders (clinic_id);
ALTER TABLE public.email_template_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_template_folders_clinic ON public.email_template_folders;
CREATE POLICY email_template_folders_clinic ON public.email_template_folders
  FOR ALL TO authenticated
  USING (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'))
  WITH CHECK (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'));

CREATE TRIGGER trg_email_template_folders_updated_at
  BEFORE UPDATE ON public.email_template_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. email_templates
-- ============================================================
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL,
  reply_to TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'marketing',
  preheader TEXT,
  blocks_json JSONB,
  variables_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  preset_label TEXT,
  folder_id UUID REFERENCES public.email_template_folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, slug),
  CONSTRAINT email_templates_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);
CREATE INDEX email_templates_clinic_idx ON public.email_templates (clinic_id);
CREATE INDEX email_templates_clinic_active_idx ON public.email_templates (clinic_id, active);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_templates_clinic ON public.email_templates;
CREATE POLICY email_templates_clinic ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'))
  WITH CHECK (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'));

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. email_unsubscribes (por clínica)
-- ============================================================
CREATE TABLE public.email_unsubscribes (
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT,
  source TEXT,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, email)
);
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_unsubscribes_read ON public.email_unsubscribes;
CREATE POLICY email_unsubscribes_read ON public.email_unsubscribes
  FOR SELECT TO authenticated
  USING (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'));
DROP POLICY IF EXISTS email_unsubscribes_admin_delete ON public.email_unsubscribes;
CREATE POLICY email_unsubscribes_admin_delete ON public.email_unsubscribes
  FOR DELETE TO authenticated
  USING (public.has_clinic_access(clinic_id) AND public.is_clinic_admin());

-- ============================================================
-- 6. email_queue
-- ============================================================
CREATE TABLE public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  template_slug TEXT,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|processing|sent|failed|cancelled
  error TEXT,
  attempts INT NOT NULL DEFAULT 0,
  related_lead_id UUID,
  related_lead_table TEXT,
  force_send BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_queue_clinic_idx ON public.email_queue (clinic_id);
CREATE INDEX email_queue_pending_idx ON public.email_queue (status, scheduled_at) WHERE status = 'pending';
CREATE UNIQUE INDEX email_queue_dedup_idx
  ON public.email_queue (clinic_id, template_slug, lower(recipient_email), related_lead_table)
  WHERE status = 'pending'
    AND related_lead_table IS NOT NULL
    AND related_lead_table <> 'leads_internal';

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_queue_clinic ON public.email_queue;
CREATE POLICY email_queue_clinic ON public.email_queue
  FOR ALL TO authenticated
  USING (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'))
  WITH CHECK (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'));

CREATE TRIGGER trg_email_queue_updated_at
  BEFORE UPDATE ON public.email_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. email_logs (append-only)
-- ============================================================
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resend_id TEXT,
  template_slug TEXT,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',  -- sent|delivered|opened|clicked|bounced|complained|failed
  error TEXT,
  related_lead_id UUID,
  related_lead_table TEXT,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX email_logs_resend_id_idx ON public.email_logs (resend_id) WHERE resend_id IS NOT NULL;
CREATE INDEX email_logs_clinic_idx ON public.email_logs (clinic_id);
CREATE INDEX email_logs_clinic_recipient_idx ON public.email_logs (clinic_id, recipient_email);
CREATE INDEX email_logs_clinic_template_idx ON public.email_logs (clinic_id, template_slug);
CREATE INDEX email_logs_clinic_sent_at_idx ON public.email_logs (clinic_id, sent_at DESC);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_logs_read ON public.email_logs;
CREATE POLICY email_logs_read ON public.email_logs
  FOR SELECT TO authenticated
  USING (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'));

-- ============================================================
-- 8. email_segments
-- ============================================================
CREATE TABLE public.email_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source_table TEXT NOT NULL DEFAULT 'leads',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_segments_clinic_idx ON public.email_segments (clinic_id);
ALTER TABLE public.email_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_segments_clinic ON public.email_segments;
CREATE POLICY email_segments_clinic ON public.email_segments
  FOR ALL TO authenticated
  USING (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'))
  WITH CHECK (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'));

CREATE TRIGGER trg_email_segments_updated_at
  BEFORE UPDATE ON public.email_segments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 9. email_automations
-- ============================================================
CREATE TABLE public.email_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  trigger_type TEXT NOT NULL,                       -- lead_created|stage_enter|lead_inactive_days
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,         -- [{template_slug, delay_days}, ...]
  preset_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_automations_clinic_idx ON public.email_automations (clinic_id);
CREATE INDEX email_automations_active_idx ON public.email_automations (clinic_id, trigger_type) WHERE active;
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_automations_clinic ON public.email_automations;
CREATE POLICY email_automations_clinic ON public.email_automations
  FOR ALL TO authenticated
  USING (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'))
  WITH CHECK (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'));

CREATE TRIGGER trg_email_automations_updated_at
  BEFORE UPDATE ON public.email_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 10. email_campaigns
-- ============================================================
CREATE TABLE public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_slug TEXT NOT NULL,
  segment_id UUID REFERENCES public.email_segments(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft|scheduled|sending|sent|failed
  total_recipients INT NOT NULL DEFAULT 0,
  enqueued_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  test_email TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_campaigns_clinic_idx ON public.email_campaigns (clinic_id);
CREATE INDEX email_campaigns_scheduled_idx ON public.email_campaigns (status, scheduled_for) WHERE status = 'scheduled';
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_campaigns_clinic ON public.email_campaigns;
CREATE POLICY email_campaigns_clinic ON public.email_campaigns
  FOR ALL TO authenticated
  USING (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'))
  WITH CHECK (public.has_clinic_access(clinic_id) AND public.clinic_has_feature(clinic_id, 'email_marketing'));

CREATE TRIGGER trg_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 11. email_send_state (cota diária por clínica)
-- ============================================================
CREATE TABLE public.email_send_state (
  clinic_id UUID PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  sent_today INT NOT NULL DEFAULT 0,
  quota_resets_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('day', now()) + interval '1 day'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_send_state_read ON public.email_send_state;
CREATE POLICY email_send_state_read ON public.email_send_state
  FOR SELECT TO authenticated
  USING (public.has_clinic_access(clinic_id));

CREATE TRIGGER trg_email_send_state_updated_at
  BEFORE UPDATE ON public.email_send_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 12. Helpers
-- ============================================================

-- Cota diária (default 1000)
CREATE OR REPLACE FUNCTION public.clinic_email_quota(_clinic_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    NULLIF(settings #>> ARRAY['email','quota_daily'], '')::int,
    1000
  )
  FROM public.clinics WHERE id = _clinic_id;
$$;

-- HMAC tokens
CREATE OR REPLACE FUNCTION public.generate_unsubscribe_token(_clinic_id UUID, _email TEXT)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _secret TEXT;
BEGIN
  SELECT value INTO _secret FROM public.app_settings WHERE key = 'unsubscribe_hmac_secret';
  IF _secret IS NULL THEN RAISE EXCEPTION 'unsubscribe_hmac_secret not configured'; END IF;
  RETURN encode(extensions.hmac(_clinic_id::text || '|' || lower(_email), _secret, 'sha256'), 'hex');
END; $$;

CREATE OR REPLACE FUNCTION public.verify_unsubscribe_token(_clinic_id UUID, _email TEXT, _token TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.generate_unsubscribe_token(_clinic_id, _email) = _token;
END; $$;

-- Wrapper para cron chamar edge functions
CREATE OR REPLACE FUNCTION public.invoke_edge_function(_function_name TEXT, _body JSONB DEFAULT '{}'::jsonb)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _url TEXT;
  _key TEXT;
  _supabase_url TEXT;
  _request_id BIGINT;
BEGIN
  SELECT value INTO _key FROM public.app_settings WHERE key = 'cron_service_role_key';
  IF _key IS NULL OR _key = 'PLACEHOLDER' THEN
    RAISE NOTICE 'cron_service_role_key not configured yet';
    RETURN NULL;
  END IF;

  _supabase_url := current_setting('app.supabase_url', true);
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    SELECT value INTO _supabase_url FROM public.app_settings WHERE key = 'supabase_url';
  END IF;
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    RAISE NOTICE 'supabase_url not configured in app_settings';
    RETURN NULL;
  END IF;

  _url := _supabase_url || '/functions/v1/' || _function_name;

  SELECT net.http_post(
    url := _url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || _key),
    body := _body,
    timeout_milliseconds := 60000
  ) INTO _request_id;
  RETURN _request_id;
END; $$;

-- Enfileira email com dedup (chamada por triggers e edge functions)
CREATE OR REPLACE FUNCTION public.enqueue_email(
  _clinic_id UUID,
  _template_slug TEXT,
  _recipient_email TEXT,
  _recipient_name TEXT DEFAULT NULL,
  _variables JSONB DEFAULT '{}'::jsonb,
  _scheduled_at TIMESTAMPTZ DEFAULT now(),
  _related_lead_id UUID DEFAULT NULL,
  _related_lead_table TEXT DEFAULT NULL,
  _force_send BOOLEAN DEFAULT false
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _email_lower TEXT := lower(_recipient_email);
BEGIN
  -- Bloqueia se feature off
  IF NOT public.clinic_has_feature(_clinic_id, 'email_marketing') THEN
    RETURN NULL;
  END IF;

  -- Dedup
  IF _related_lead_table IS NOT NULL AND _related_lead_table <> 'leads_internal' THEN
    IF EXISTS (
      SELECT 1 FROM public.email_queue
      WHERE clinic_id = _clinic_id
        AND template_slug = _template_slug
        AND lower(recipient_email) = _email_lower
        AND related_lead_table = _related_lead_table
        AND status = 'pending'
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Template precisa existir e estar ativo
  IF NOT EXISTS (
    SELECT 1 FROM public.email_templates
    WHERE clinic_id = _clinic_id AND slug = _template_slug AND active = true
  ) THEN
    RAISE NOTICE 'enqueue_email: template % not found or inactive for clinic %', _template_slug, _clinic_id;
    RETURN NULL;
  END IF;

  INSERT INTO public.email_queue (
    clinic_id, template_slug, recipient_email, recipient_name, variables,
    scheduled_at, related_lead_id, related_lead_table, force_send
  ) VALUES (
    _clinic_id, _template_slug, _email_lower, _recipient_name, _variables,
    _scheduled_at, _related_lead_id, _related_lead_table, _force_send
  ) RETURNING id INTO _id;
  RETURN _id;
END; $$;

-- Reset diário de cota
CREATE OR REPLACE FUNCTION public.reset_email_send_state()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.email_send_state
  SET sent_today = 0,
      quota_resets_at = date_trunc('day', now()) + interval '1 day',
      updated_at = now()
  WHERE quota_resets_at <= now();
$$;

-- Add feature email_marketing default true para todas as clínicas existentes (sem alterar — flag ausente = on)
-- nada a fazer pois o sistema de features trata ausência como liberada

-- ============================================================
-- 13. Triggers de envio (opt-in via email_automations)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_email_on_lead_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  auto RECORD;
  step JSONB;
  delay_days NUMERIC;
  template_slug TEXT;
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN RETURN NEW; END IF;
  IF NOT public.clinic_has_feature(NEW.clinic_id, 'email_marketing') THEN RETURN NEW; END IF;

  FOR auto IN
    SELECT id, steps FROM public.email_automations
    WHERE clinic_id = NEW.clinic_id
      AND active = true
      AND trigger_type = 'lead_created'
  LOOP
    FOR step IN SELECT * FROM jsonb_array_elements(auto.steps)
    LOOP
      template_slug := step->>'template_slug';
      delay_days := COALESCE((step->>'delay_days')::numeric, 0);
      IF template_slug IS NULL THEN CONTINUE; END IF;
      PERFORM public.enqueue_email(
        NEW.clinic_id,
        template_slug,
        NEW.email,
        NEW.name,
        jsonb_build_object('name', NEW.name, 'lead_id', NEW.id, 'automation_id', auto.id),
        now() + (delay_days || ' days')::interval,
        NEW.id,
        'auto_' || auto.id::text,
        false
      );
    END LOOP;
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_email_on_lead_created ON public.leads;
CREATE TRIGGER trg_email_on_lead_created
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_email_on_lead_created();

CREATE OR REPLACE FUNCTION public.tg_email_on_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  auto RECORD;
  step JSONB;
  delay_days NUMERIC;
  template_slug TEXT;
BEGIN
  IF NEW.stage_id IS NULL OR NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;
  IF NEW.email IS NULL OR NEW.email = '' THEN RETURN NEW; END IF;
  IF NOT public.clinic_has_feature(NEW.clinic_id, 'email_marketing') THEN RETURN NEW; END IF;

  FOR auto IN
    SELECT id, steps FROM public.email_automations
    WHERE clinic_id = NEW.clinic_id
      AND active = true
      AND trigger_type = 'stage_enter'
      AND (trigger_config->>'stage_id')::uuid = NEW.stage_id
  LOOP
    FOR step IN SELECT * FROM jsonb_array_elements(auto.steps)
    LOOP
      template_slug := step->>'template_slug';
      delay_days := COALESCE((step->>'delay_days')::numeric, 0);
      IF template_slug IS NULL THEN CONTINUE; END IF;
      PERFORM public.enqueue_email(
        NEW.clinic_id,
        template_slug,
        NEW.email,
        NEW.name,
        jsonb_build_object('name', NEW.name, 'lead_id', NEW.id, 'automation_id', auto.id),
        now() + (delay_days || ' days')::interval,
        NEW.id,
        'auto_' || auto.id::text,
        false
      );
    END LOOP;
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_email_on_stage_change ON public.leads;
CREATE TRIGGER trg_email_on_stage_change
  AFTER UPDATE OF stage_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_email_on_stage_change();

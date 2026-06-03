
-- ============================================================
-- FASE 1.1: Stripe columns reservadas + reset do catálogo
-- ============================================================
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id_monthly text,
  ADD COLUMN IF NOT EXISTS stripe_price_id_yearly text;

-- Remove planos antigos (catalogo será recriado abaixo)
DELETE FROM public.plans WHERE code IN ('free','starter','pro','enterprise');

-- Seed novos planos (features/limits vazios — editados via UI)
INSERT INTO public.plans (code, name, description, price_monthly_brl, price_yearly_brl, features, limits, sort_order, is_active, is_public)
VALUES
  ('starter', 'Starter', 'Plano de entrada',           77.00,  470.00, '{}'::jsonb, '{}'::jsonb, 1, true, true),
  ('pro',     'Pro',     'Plano intermediário',       147.00,  997.00, '{}'::jsonb, '{}'::jsonb, 2, true, true),
  ('supreme', 'Supreme', 'Plano completo',            297.00, 2997.00, '{}'::jsonb, '{}'::jsonb, 3, true, true);

-- ============================================================
-- FASE 1.2: clinics.plan_id + espelho
-- ============================================================
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id);

-- Backfill: mapeia plano texto antigo para o novo catálogo
UPDATE public.clinics SET plan_id = (SELECT id FROM public.plans WHERE code='supreme') WHERE plan IN ('enterprise');
UPDATE public.clinics SET plan_id = (SELECT id FROM public.plans WHERE code='pro')     WHERE plan IN ('pro');
UPDATE public.clinics SET plan_id = (SELECT id FROM public.plans WHERE code='starter') WHERE plan_id IS NULL;

-- Normaliza coluna texto para refletir o novo código
UPDATE public.clinics c SET plan = p.code FROM public.plans p WHERE p.id = c.plan_id AND c.plan <> p.code;

-- Trigger que mantém clinics.plan (texto) sincronizado com plan_id
CREATE OR REPLACE FUNCTION public.clinics_sync_plan_text()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.plan_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.plan_id IS DISTINCT FROM OLD.plan_id) THEN
    SELECT code INTO NEW.plan FROM public.plans WHERE id = NEW.plan_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinics_sync_plan_text ON public.clinics;
CREATE TRIGGER trg_clinics_sync_plan_text
  BEFORE INSERT OR UPDATE OF plan_id ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.clinics_sync_plan_text();

-- ============================================================
-- FASE 1.3: clinic_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clinic_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'manual_grant',
  source text NOT NULL DEFAULT 'manual',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  granted_by uuid REFERENCES auth.users(id),
  grant_reason text,
  stripe_subscription_id text,
  stripe_customer_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validação de status/source via trigger (evita CHECK estático)
CREATE OR REPLACE FUNCTION public.clinic_subscriptions_validate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('trialing','active','past_due','canceled','manual_grant') THEN
    RAISE EXCEPTION 'invalid status %', NEW.status;
  END IF;
  IF NEW.source NOT IN ('manual','stripe') THEN
    RAISE EXCEPTION 'invalid source %', NEW.source;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinic_subscriptions_validate ON public.clinic_subscriptions;
CREATE TRIGGER trg_clinic_subscriptions_validate
  BEFORE INSERT OR UPDATE ON public.clinic_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.clinic_subscriptions_validate();

-- Apenas 1 assinatura "current" por clínica
CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_subscriptions_current
  ON public.clinic_subscriptions(clinic_id) WHERE is_current;

CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_clinic ON public.clinic_subscriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_plan ON public.clinic_subscriptions(plan_id);

GRANT SELECT ON public.clinic_subscriptions TO authenticated;
GRANT ALL ON public.clinic_subscriptions TO service_role;

ALTER TABLE public.clinic_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_subscriptions_select ON public.clinic_subscriptions FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());

CREATE POLICY clinic_subscriptions_super_all ON public.clinic_subscriptions FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS trg_clinic_subscriptions_updated_at ON public.clinic_subscriptions;
CREATE TRIGGER trg_clinic_subscriptions_updated_at
  BEFORE UPDATE ON public.clinic_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- FASE 1.4: plan_change_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plan_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.clinic_subscriptions(id) ON DELETE SET NULL,
  from_plan_id uuid REFERENCES public.plans(id),
  to_plan_id uuid REFERENCES public.plans(id),
  from_status text,
  to_status text,
  source text,
  changed_by uuid REFERENCES auth.users(id),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_change_log_clinic ON public.plan_change_log(clinic_id, created_at DESC);

GRANT SELECT ON public.plan_change_log TO authenticated;
GRANT ALL ON public.plan_change_log TO service_role;

ALTER TABLE public.plan_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_change_log_select ON public.plan_change_log FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());

CREATE POLICY plan_change_log_super_all ON public.plan_change_log FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Trigger: registra mudanças automaticamente
CREATE OR REPLACE FUNCTION public.clinic_subscriptions_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.plan_change_log (clinic_id, subscription_id, from_plan_id, to_plan_id, from_status, to_status, source, changed_by, reason)
    VALUES (NEW.clinic_id, NEW.id, NULL, NEW.plan_id, NULL, NEW.status, NEW.source, NEW.granted_by, NEW.grant_reason);
  ELSIF TG_OP = 'UPDATE' AND (OLD.plan_id IS DISTINCT FROM NEW.plan_id OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.plan_change_log (clinic_id, subscription_id, from_plan_id, to_plan_id, from_status, to_status, source, changed_by, reason)
    VALUES (NEW.clinic_id, NEW.id, OLD.plan_id, NEW.plan_id, OLD.status, NEW.status, NEW.source, NEW.granted_by, NEW.grant_reason);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinic_subscriptions_audit ON public.clinic_subscriptions;
CREATE TRIGGER trg_clinic_subscriptions_audit
  AFTER INSERT OR UPDATE ON public.clinic_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.clinic_subscriptions_audit();

-- ============================================================
-- FASE 1.5: current_clinic_plan() + sincroniza clinics.plan_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_clinic_plan(_clinic uuid)
RETURNS TABLE (plan_id uuid, plan_code text, status text, source text, trial_ends_at timestamptz, current_period_end timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.plan_id, p.code, s.status, s.source, s.trial_ends_at, s.current_period_end
  FROM public.clinic_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.clinic_id = _clinic AND s.is_current
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_clinic_plan(uuid) TO authenticated;

-- Trigger: ao alterar/inserir subscription "current", atualiza clinics.plan_id
CREATE OR REPLACE FUNCTION public.clinic_subscriptions_sync_clinic_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_current THEN
    UPDATE public.clinics SET plan_id = NEW.plan_id WHERE id = NEW.clinic_id AND plan_id IS DISTINCT FROM NEW.plan_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinic_subscriptions_sync_clinic_plan ON public.clinic_subscriptions;
CREATE TRIGGER trg_clinic_subscriptions_sync_clinic_plan
  AFTER INSERT OR UPDATE OF plan_id, is_current ON public.clinic_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.clinic_subscriptions_sync_clinic_plan();

-- ============================================================
-- BACKFILL: subscription manual_grant para clínicas existentes
-- ============================================================
INSERT INTO public.clinic_subscriptions (clinic_id, plan_id, status, source, grant_reason, is_current)
SELECT c.id, c.plan_id, 'manual_grant', 'manual', 'Backfill — migração inicial', true
FROM public.clinics c
WHERE c.plan_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.clinic_subscriptions s WHERE s.clinic_id = c.id AND s.is_current);


-- invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.clinic_subscriptions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.plans(id),
  amount_brl numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'open',
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_date date,
  paid_at timestamptz,
  payment_method text,
  period_start date,
  period_end date,
  description text,
  notes text,
  stripe_invoice_id text,
  created_by uuid REFERENCES auth.users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.invoices_validate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('draft','open','paid','overdue','void') THEN
    RAISE EXCEPTION 'invalid status %', NEW.status;
  END IF;
  IF NEW.amount_brl < 0 THEN RAISE EXCEPTION 'amount_brl negativo'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_validate ON public.invoices;
CREATE TRIGGER trg_invoices_validate BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_validate();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_invoices_clinic ON public.invoices(clinic_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status, due_date);

GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());
CREATE POLICY invoices_super_all ON public.invoices FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- payment_receipts
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_receipts_select ON public.payment_receipts FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());
CREATE POLICY payment_receipts_super_all ON public.payment_receipts FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Marcador de vencidas (job)
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.invoices
    SET status = 'overdue', updated_at = now()
    WHERE status = 'open' AND due_date IS NOT NULL AND due_date < current_date;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- KPIs e relatórios
CREATE OR REPLACE FUNCTION public.admin_finance_kpis()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'revenue_month', COALESCE((SELECT SUM(amount_brl) FROM public.invoices WHERE status='paid' AND paid_at >= date_trunc('month', now())), 0),
    'revenue_total', COALESCE((SELECT SUM(amount_brl) FROM public.invoices WHERE status='paid'), 0),
    'overdue_total', COALESCE((SELECT SUM(amount_brl) FROM public.invoices WHERE status='overdue'), 0),
    'overdue_count', (SELECT COUNT(*) FROM public.invoices WHERE status='overdue'),
    'open_count', (SELECT COUNT(*) FROM public.invoices WHERE status='open'),
    'paid_count_month', (SELECT COUNT(*) FROM public.invoices WHERE status='paid' AND paid_at >= date_trunc('month', now())),
    'mrr', COALESCE((
      SELECT SUM(p.price_monthly_brl)
      FROM public.clinic_subscriptions s
      JOIN public.plans p ON p.id = s.plan_id
      WHERE s.is_current AND s.status IN ('active','trialing','manual_grant')
    ), 0),
    'subscriptions_active', (SELECT COUNT(*) FROM public.clinic_subscriptions WHERE is_current AND status IN ('active','trialing','manual_grant')),
    'subscriptions_trial', (SELECT COUNT(*) FROM public.clinic_subscriptions WHERE is_current AND status='trialing'),
    'subscriptions_manual', (SELECT COUNT(*) FROM public.clinic_subscriptions WHERE is_current AND status='manual_grant'),
    'subscriptions_past_due', (SELECT COUNT(*) FROM public.clinic_subscriptions WHERE is_current AND status='past_due')
  ) INTO result;
  result := result || jsonb_build_object('arr', (result->>'mrr')::numeric * 12);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revenue_timeseries(_months int DEFAULT 12)
RETURNS TABLE (month date, revenue numeric, invoices_paid bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT date_trunc('month', i.paid_at)::date AS month,
         SUM(i.amount_brl)::numeric AS revenue,
         COUNT(*)::bigint AS invoices_paid
  FROM public.invoices i
  WHERE i.status='paid' AND i.paid_at IS NOT NULL
    AND i.paid_at >= date_trunc('month', now()) - make_interval(months => _months - 1)
  GROUP BY 1 ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_overdue_list()
RETURNS TABLE (invoice_id uuid, clinic_id uuid, clinic_name text, amount_brl numeric, due_date date, days_overdue int, description text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT i.id, c.id, c.name, i.amount_brl, i.due_date, (current_date - i.due_date)::int, i.description
  FROM public.invoices i
  JOIN public.clinics c ON c.id = i.clinic_id
  WHERE i.status = 'overdue'
  ORDER BY i.due_date ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_plan_distribution()
RETURNS TABLE (plan_code text, plan_name text, clinics_count bigint, price_monthly numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.code, p.name, COUNT(s.id)::bigint, p.price_monthly_brl
  FROM public.plans p
  LEFT JOIN public.clinic_subscriptions s ON s.plan_id = p.id AND s.is_current AND s.status IN ('active','trialing','manual_grant')
  GROUP BY p.id, p.code, p.name, p.price_monthly_brl, p.sort_order
  ORDER BY p.sort_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_finance_kpis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revenue_timeseries(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_overdue_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_plan_distribution() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO service_role;

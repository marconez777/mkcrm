
-- feature_events
CREATE TABLE IF NOT EXISTS public.feature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL,
  action text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_events_clinic_created ON public.feature_events(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_events_feature_created ON public.feature_events(feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_events_user_created ON public.feature_events(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.feature_events TO authenticated;
GRANT ALL ON public.feature_events TO service_role;

ALTER TABLE public.feature_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_events_select ON public.feature_events FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());

CREATE POLICY feature_events_insert ON public.feature_events FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id() OR public.is_super_admin());

-- error_events
CREATE TABLE IF NOT EXISTS public.error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  surface text NOT NULL,
  route text,
  function_name text,
  error_message text NOT NULL,
  error_stack text,
  severity text NOT NULL DEFAULT 'error',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.error_events_validate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.surface NOT IN ('frontend','edge_function','trigger') THEN
    RAISE EXCEPTION 'invalid surface %', NEW.surface;
  END IF;
  IF NEW.severity NOT IN ('info','warn','error','fatal') THEN
    RAISE EXCEPTION 'invalid severity %', NEW.severity;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_error_events_validate ON public.error_events;
CREATE TRIGGER trg_error_events_validate
  BEFORE INSERT OR UPDATE ON public.error_events
  FOR EACH ROW EXECUTE FUNCTION public.error_events_validate();

CREATE INDEX IF NOT EXISTS idx_error_events_created ON public.error_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_clinic ON public.error_events(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_surface ON public.error_events(surface, created_at DESC);

GRANT SELECT, INSERT ON public.error_events TO authenticated;
GRANT ALL ON public.error_events TO service_role;

ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY error_events_select ON public.error_events FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());

CREATE POLICY error_events_insert ON public.error_events FOR INSERT TO authenticated
  WITH CHECK (true);

-- RPCs (super admin)
CREATE OR REPLACE FUNCTION public.admin_feature_usage(_days int DEFAULT 30)
RETURNS TABLE (feature text, day date, events bigint, users bigint, clinics bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT fe.feature,
         (fe.created_at AT TIME ZONE 'UTC')::date AS day,
         COUNT(*)::bigint AS events,
         COUNT(DISTINCT fe.user_id)::bigint AS users,
         COUNT(DISTINCT fe.clinic_id)::bigint AS clinics
  FROM public.feature_events fe
  WHERE fe.created_at >= now() - make_interval(days => _days)
  GROUP BY 1, 2
  ORDER BY 2 DESC, 3 DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_dead_features(_days int DEFAULT 30)
RETURNS TABLE (feature text, last_event timestamptz, total_events bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT fe.feature, MAX(fe.created_at), COUNT(*)::bigint
  FROM public.feature_events fe
  GROUP BY fe.feature
  HAVING MAX(fe.created_at) < now() - make_interval(days => _days)
  ORDER BY MAX(fe.created_at) ASC NULLS FIRST;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_error_summary(_days int DEFAULT 7)
RETURNS TABLE (day date, surface text, severity text, count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT (ee.created_at AT TIME ZONE 'UTC')::date, ee.surface, ee.severity, COUNT(*)::bigint
  FROM public.error_events ee
  WHERE ee.created_at >= now() - make_interval(days => _days)
  GROUP BY 1, 2, 3
  ORDER BY 1 DESC, 4 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_feature_usage(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dead_features(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_error_summary(int) TO authenticated;

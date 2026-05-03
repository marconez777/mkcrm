-- Lock down every public table to authenticated users only.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS public_all ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_all ON public.%I', r.tablename);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format(
      'CREATE POLICY authenticated_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      r.tablename
    );
  END LOOP;
END $$;

-- 1. clinic_email_integrations: scope SELECT to current clinic
DROP POLICY IF EXISTS "Clinic admins view their integration" ON public.clinic_email_integrations;
CREATE POLICY "Clinic admins view their integration"
  ON public.clinic_email_integrations
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin(auth.uid()));

-- 2. messages: remove permissive subscribe-all policy
DROP POLICY IF EXISTS "authenticated_can_subscribe" ON public.messages;

-- 3. email_operational_alerts: scope admin SELECT/UPDATE to own clinic
DROP POLICY IF EXISTS "Admins can view all operational alerts" ON public.email_operational_alerts;
DROP POLICY IF EXISTS "Admins can resolve operational alerts" ON public.email_operational_alerts;
CREATE POLICY "Admins can resolve operational alerts"
  ON public.email_operational_alerts
  FOR UPDATE TO authenticated
  USING (
    (clinic_id IS NOT NULL AND clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
    OR public.is_super_admin()
  );

-- 4. storage email-assets: restrict update/delete to file owner
DROP POLICY IF EXISTS "email-assets authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "email-assets authenticated delete" ON storage.objects;
CREATE POLICY "email-assets owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'email-assets' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'email-assets' AND owner = auth.uid());
CREATE POLICY "email-assets owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'email-assets' AND owner = auth.uid());

-- 5. Make existing views security_invoker (fix SECURITY DEFINER view linter)
ALTER VIEW public.email_throughput_stats SET (security_invoker = on);
ALTER VIEW public.email_system_health SET (security_invoker = on);

-- 6. realtime.messages: drop permissive subscribe-all policy
-- (App uses postgres_changes which enforces RLS on underlying tables; no broadcast/presence usage.)
DROP POLICY IF EXISTS "authenticated_can_subscribe" ON realtime.messages;

-- 1) Restrict reading WhatsApp instance secrets to service_role only
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM authenticated;
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM anon;

-- 2) Restrict reading form integration tokens to clinic admins only
DROP POLICY IF EXISTS form_integrations_select ON public.form_integrations;
CREATE POLICY form_integrations_select ON public.form_integrations
  FOR SELECT
  TO authenticated
  USING (has_clinic_access(clinic_id) AND is_clinic_admin());

-- 3) Scope email-assets uploads to the uploader's clinic folder
DROP POLICY IF EXISTS "email-assets authenticated upload" ON storage.objects;
CREATE POLICY "email-assets authenticated upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'email-assets'
    AND split_part(name, '/', 1) = current_clinic_id()::text
  );

DROP POLICY IF EXISTS "email-assets owner update" ON storage.objects;
CREATE POLICY "email-assets owner update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'email-assets'
    AND (owner = auth.uid() OR split_part(name, '/', 1) = current_clinic_id()::text)
  )
  WITH CHECK (
    bucket_id = 'email-assets'
    AND split_part(name, '/', 1) = current_clinic_id()::text
  );

DROP POLICY IF EXISTS "email-assets owner delete" ON storage.objects;
CREATE POLICY "email-assets owner delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'email-assets'
    AND (owner = auth.uid() OR split_part(name, '/', 1) = current_clinic_id()::text)
  );
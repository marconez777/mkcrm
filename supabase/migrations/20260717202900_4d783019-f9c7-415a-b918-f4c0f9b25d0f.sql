
-- 1) clinic_email_integrations: replace client-controlled current_clinic_id() with membership check
DROP POLICY IF EXISTS "Clinic admins view their integration" ON public.clinic_email_integrations;
CREATE POLICY "Clinic admins view their integration"
ON public.clinic_email_integrations
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = clinic_email_integrations.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
  )
);

-- 2) email_recipient_throttle: lock writes explicitly (backend/service_role only)
REVOKE INSERT, UPDATE, DELETE ON public.email_recipient_throttle FROM authenticated, anon;
GRANT ALL ON public.email_recipient_throttle TO service_role;

DROP POLICY IF EXISTS "email_recipient_throttle_no_client_write" ON public.email_recipient_throttle;
CREATE POLICY "email_recipient_throttle_no_client_write"
ON public.email_recipient_throttle
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- 3) pipeline_tenant_classifiers: scope to clinic membership (admin/owner)
DROP POLICY IF EXISTS "Admins can insert pipeline_tenant_classifiers" ON public.pipeline_tenant_classifiers;
DROP POLICY IF EXISTS "Admins can update pipeline_tenant_classifiers" ON public.pipeline_tenant_classifiers;
DROP POLICY IF EXISTS "Authenticated users can read pipeline_tenant_classifiers" ON public.pipeline_tenant_classifiers;

CREATE POLICY "pipeline_tenant_classifiers_select"
ON public.pipeline_tenant_classifiers
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = pipeline_tenant_classifiers.clinic_id
      AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "pipeline_tenant_classifiers_insert"
ON public.pipeline_tenant_classifiers
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = pipeline_tenant_classifiers.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
  )
);

CREATE POLICY "pipeline_tenant_classifiers_update"
ON public.pipeline_tenant_classifiers
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = pipeline_tenant_classifiers.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = pipeline_tenant_classifiers.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
  )
);

CREATE POLICY "pipeline_tenant_classifiers_delete"
ON public.pipeline_tenant_classifiers
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = pipeline_tenant_classifiers.clinic_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
  )
);

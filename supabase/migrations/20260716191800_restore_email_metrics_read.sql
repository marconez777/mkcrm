-- Restore SELECT access to email_logs and email_queue for all clinic members 
-- that have the email_marketing feature (reverting the strict admin-only restriction from 20260618174158)

DROP POLICY IF EXISTS email_logs_admin_read ON public.email_logs;
CREATE POLICY email_logs_read ON public.email_logs
  FOR SELECT TO authenticated
  USING (
    has_clinic_access(clinic_id)
    AND clinic_has_feature(clinic_id, 'email_marketing')
  );

DROP POLICY IF EXISTS email_queue_admin_select ON public.email_queue;
CREATE POLICY email_queue_select ON public.email_queue
  FOR SELECT TO authenticated
  USING (
    has_clinic_access(clinic_id)
    AND clinic_has_feature(clinic_id, 'email_marketing')
  );

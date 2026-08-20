ALTER TABLE public._bkp_20260813_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_20260813_leads_stage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_20260813_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_20260820_paciente_inativo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_20260820b_inativo_120d ENABLE ROW LEVEL SECURITY;

ALTER TABLE public._bkp_20260813_aliases FORCE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_20260813_leads_stage FORCE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_20260813_stages FORCE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_20260820_paciente_inativo FORCE ROW LEVEL SECURITY;
ALTER TABLE public._bkp_20260820b_inativo_120d FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public._bkp_20260813_aliases FROM anon, authenticated;
REVOKE ALL ON public._bkp_20260813_leads_stage FROM anon, authenticated;
REVOKE ALL ON public._bkp_20260813_stages FROM anon, authenticated;
REVOKE ALL ON public._bkp_20260820_paciente_inativo FROM anon, authenticated;
REVOKE ALL ON public._bkp_20260820b_inativo_120d FROM anon, authenticated;

GRANT ALL ON public._bkp_20260813_aliases TO service_role;
GRANT ALL ON public._bkp_20260813_leads_stage TO service_role;
GRANT ALL ON public._bkp_20260813_stages TO service_role;
GRANT ALL ON public._bkp_20260820_paciente_inativo TO service_role;
GRANT ALL ON public._bkp_20260820b_inativo_120d TO service_role;

DROP POLICY IF EXISTS "email-assets owner delete" ON storage.objects;
DROP POLICY IF EXISTS "email-assets owner update" ON storage.objects;

CREATE POLICY "email-assets clinic delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'email-assets'
  AND split_part(name, '/', 1) = (public.current_clinic_id())::text
);

CREATE POLICY "email-assets clinic update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'email-assets'
  AND split_part(name, '/', 1) = (public.current_clinic_id())::text
)
WITH CHECK (
  bucket_id = 'email-assets'
  AND split_part(name, '/', 1) = (public.current_clinic_id())::text
);
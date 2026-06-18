
-- 1) clinic_secrets: lock down to service_role only
ALTER TABLE public.clinic_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinic_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.clinic_secrets TO service_role;
DROP POLICY IF EXISTS "clinic_secrets service role only" ON public.clinic_secrets;
-- No policies for anon/authenticated => no access. Service role bypasses RLS.

-- 2) lead_ai_settings: restrict to authenticated role
DROP POLICY IF EXISTS "lead_ai_settings clinic scoped" ON public.lead_ai_settings;
CREATE POLICY "lead_ai_settings clinic scoped"
ON public.lead_ai_settings
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_ai_settings.lead_id AND l.clinic_id = current_clinic_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_ai_settings.lead_id AND l.clinic_id = current_clinic_id()));

-- 3) stage_ai_defaults: restrict to authenticated role
DROP POLICY IF EXISTS "stage_ai_defaults clinic scoped" ON public.stage_ai_defaults;
CREATE POLICY "stage_ai_defaults clinic scoped"
ON public.stage_ai_defaults
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.pipeline_stages s WHERE s.id = stage_ai_defaults.stage_id AND s.clinic_id = current_clinic_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.pipeline_stages s WHERE s.id = stage_ai_defaults.stage_id AND s.clinic_id = current_clinic_id()));

-- 4) embedding_cache: lock to service_role
ALTER TABLE public.embedding_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.embedding_cache FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.embedding_cache TO service_role;

-- 5) rag_cache: ensure writes only via service_role (revoke any insert/update/delete from authenticated/anon)
ALTER TABLE public.rag_cache ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.rag_cache FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rag_cache TO service_role;

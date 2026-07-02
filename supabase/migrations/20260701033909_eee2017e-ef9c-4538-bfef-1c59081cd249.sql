
-- Drop legacy settings table (superseded by whatsapp_instances)
DROP TABLE IF EXISTS public.settings CASCADE;

-- Explicit deny policies on estudo-cache bucket for auditability
DROP POLICY IF EXISTS "estudo_cache_no_authenticated_access" ON storage.objects;
DROP POLICY IF EXISTS "estudo_cache_no_anon_access" ON storage.objects;

CREATE POLICY "estudo_cache_no_authenticated_access"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id <> 'estudo-cache')
  WITH CHECK (bucket_id <> 'estudo-cache');

CREATE POLICY "estudo_cache_no_anon_access"
  ON storage.objects FOR ALL
  TO anon
  USING (bucket_id <> 'estudo-cache')
  WITH CHECK (bucket_id <> 'estudo-cache');

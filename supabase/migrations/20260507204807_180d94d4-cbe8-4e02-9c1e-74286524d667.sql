
-- =============================================================
-- SECURITY HARDENING MIGRATION
-- =============================================================

-- 1) Hide sensitive credential columns from authenticated role.
--    Writes still work via UPDATE (column-level UPDATE remains granted by default
--    when REVOKE targets only SELECT). RLS continues to enforce clinic scope.

REVOKE SELECT (api_key, embedding_api_key, reranker_api_key) ON public.ai_agents FROM authenticated, anon;
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM authenticated, anon;
REVOKE SELECT (evolution_api_key, webhook_token) ON public.settings FROM authenticated, anon;

-- 2) Make storage buckets private and replace public-read policies with auth-scoped ones.

UPDATE storage.buckets SET public = false WHERE id IN ('chat-attachments', 'task-attachments');

DROP POLICY IF EXISTS "chat-attachments public read" ON storage.objects;
DROP POLICY IF EXISTS "task attachments public read" ON storage.objects;

CREATE POLICY "chat-attachments authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');

CREATE POLICY "task attachments authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

-- 3) Realtime channel authorization: require authenticated to read realtime.messages.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'authenticated_can_subscribe'
  ) THEN
    CREATE POLICY "authenticated_can_subscribe"
    ON realtime.messages FOR SELECT TO authenticated
    USING (true);
  END IF;
END $$;

-- 4) Lock down SECURITY DEFINER helper functions: revoke EXECUTE from anon.
REVOKE EXECUTE ON FUNCTION public.log_agent_trace(uuid, uuid, uuid, uuid, integer, text, text, integer, integer, integer, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_agent_caches() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_webhook_events() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_webhook_dedup() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_clinic_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_clinic_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_clinic_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_clinic_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_clinic_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_unread(uuid, text, timestamptz) FROM anon;

-- 1. Fix Realtime cross-clinic leak: drop overly-permissive SELECT policy on messages.
DROP POLICY IF EXISTS "authenticated_can_subscribe" ON public.messages;

-- 2. Make current_clinic_id() deterministic (avoid privilege escalation for multi-clinic users).
CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT clinic_id FROM public.clinic_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC, clinic_id ASC
  LIMIT 1;
$$;

-- 3. Storage: scope attachments to caller's clinic.
-- chat-attachments path layout: "<lead_id>/<filename>"
DROP POLICY IF EXISTS "chat-attachments authenticated read"   ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments authenticated delete" ON storage.objects;

CREATE POLICY "chat-attachments clinic read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = split_part(name, '/', 1)
      AND l.clinic_id = public.current_clinic_id()
  )
);

CREATE POLICY "chat-attachments clinic insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = split_part(name, '/', 1)
      AND l.clinic_id = public.current_clinic_id()
  )
);

CREATE POLICY "chat-attachments clinic delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = split_part(name, '/', 1)
      AND l.clinic_id = public.current_clinic_id()
  )
);

-- task-attachments path layout: "<task_id>/<filename>"
DROP POLICY IF EXISTS "task attachments authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "task attachments auth insert"        ON storage.objects;
DROP POLICY IF EXISTS "task attachments auth update"        ON storage.objects;
DROP POLICY IF EXISTS "task attachments auth delete"        ON storage.objects;

CREATE POLICY "task-attachments clinic read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = split_part(name, '/', 1)
      AND t.clinic_id = public.current_clinic_id()
  )
);

CREATE POLICY "task-attachments clinic insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = split_part(name, '/', 1)
      AND t.clinic_id = public.current_clinic_id()
  )
);

CREATE POLICY "task-attachments clinic update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = split_part(name, '/', 1)
      AND t.clinic_id = public.current_clinic_id()
  )
);

CREATE POLICY "task-attachments clinic delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = split_part(name, '/', 1)
      AND t.clinic_id = public.current_clinic_id()
  )
);

-- 4. Tighten cache tables: only service_role should write/read these (edge functions).
DROP POLICY IF EXISTS authenticated_all ON public.embedding_cache;
DROP POLICY IF EXISTS authenticated_all ON public.rag_cache;
DROP POLICY IF EXISTS authenticated_all ON public.webhook_dedup;

-- 5. Revoke EXECUTE on internal SECURITY DEFINER helpers from anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.log_agent_trace(uuid, uuid, uuid, uuid, integer, text, text, integer, integer, integer, text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
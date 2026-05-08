
-- 1) Remove permissive SELECT policy on messages
DROP POLICY IF EXISTS authenticated_can_subscribe ON public.messages;

-- 2) Fix chat-attachments storage policies (use objects.name, not l.name)
DROP POLICY IF EXISTS "chat_attachments_clinic_read" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_clinic_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_clinic_delete" ON storage.objects;

CREATE POLICY "chat_attachments_clinic_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = split_part(objects.name, '/', 1)
      AND l.clinic_id = public.current_clinic_id()
  )
);

CREATE POLICY "chat_attachments_clinic_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = split_part(objects.name, '/', 1)
      AND l.clinic_id = public.current_clinic_id()
  )
);

CREATE POLICY "chat_attachments_clinic_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = split_part(objects.name, '/', 1)
      AND l.clinic_id = public.current_clinic_id()
  )
);

-- 3) Tighten is_clinic_admin to require admin role in the CURRENT clinic
CREATE OR REPLACE FUNCTION public.is_clinic_admin(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.clinic_members
    WHERE user_id = _user_id
      AND clinic_id = public.current_clinic_id()
      AND role IN ('owner', 'admin')
  );
$function$;

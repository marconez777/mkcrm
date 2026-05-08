-- Drop existing chat-attachments policies (the path prefix is message_id, not lead_id)
DROP POLICY IF EXISTS "chat-attachments clinic read" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments clinic insert" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments clinic delete" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_clinic_read" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_clinic_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_clinic_delete" ON storage.objects;

-- Recreate using messages -> leads join (path is <message_id>/<filename>)
CREATE POLICY "chat_attachments_clinic_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.leads l ON l.id = m.lead_id
    WHERE m.id::text = split_part(objects.name, '/', 1)
      AND l.clinic_id = public.current_clinic_id()
  )
);

CREATE POLICY "chat_attachments_clinic_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.leads l ON l.id = m.lead_id
    WHERE m.id::text = split_part(objects.name, '/', 1)
      AND l.clinic_id = public.current_clinic_id()
  )
);

CREATE POLICY "chat_attachments_clinic_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.leads l ON l.id = m.lead_id
    WHERE m.id::text = split_part(objects.name, '/', 1)
      AND l.clinic_id = public.current_clinic_id()
  )
);
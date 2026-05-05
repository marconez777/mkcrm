
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.task_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_task_attachments_task ON public.task_attachments(task_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_attachments;

INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "task attachments public read" ON storage.objects FOR SELECT USING (bucket_id = 'task-attachments');
CREATE POLICY "task attachments auth insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-attachments');
CREATE POLICY "task attachments auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'task-attachments');
CREATE POLICY "task attachments auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'task-attachments');

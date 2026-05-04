-- Internal notes per lead
CREATE TABLE public.lead_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  author_id uuid,
  author_name text,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.lead_internal_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_lead_internal_notes_lead ON public.lead_internal_notes(lead_id, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_internal_notes;

-- Lead tasks / follow-ups
CREATE TABLE public.lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.lead_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_lead_tasks_due ON public.lead_tasks(due_at) WHERE done_at IS NULL;
CREATE INDEX idx_lead_tasks_lead ON public.lead_tasks(lead_id, due_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tasks;

-- Scheduled outbound messages
CREATE TABLE public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  content text NOT NULL,
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.scheduled_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_scheduled_pending ON public.scheduled_messages(send_at) WHERE status = 'pending';
CREATE INDEX idx_scheduled_lead ON public.scheduled_messages(lead_id, send_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_messages;

-- Enable cron + net for scheduling dispatcher
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.task_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.task_boards FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.task_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.task_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.task_columns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_task_columns_board ON public.task_columns(board_id, position);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.task_boards(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.task_columns(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  done_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_tasks_column ON public.tasks(column_id, position);
CREATE INDEX idx_tasks_board ON public.tasks(board_id);
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.task_assignees (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  attendant_id uuid NOT NULL REFERENCES public.attendants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, attendant_id)
);
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.task_assignees FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.task_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.task_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.task_labels FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.task_label_links (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.task_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);
ALTER TABLE public.task_label_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.task_label_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.task_checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_task_checklist_task ON public.task_checklist_items(task_id, position);

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_labels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_label_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_checklist_items;

-- Seed default board with 3 columns
DO $$
DECLARE bid uuid;
BEGIN
  INSERT INTO public.task_boards(name, position) VALUES ('Geral', 0) RETURNING id INTO bid;
  INSERT INTO public.task_columns(board_id, name, position) VALUES
    (bid, 'A fazer', 0),
    (bid, 'Fazendo', 1),
    (bid, 'Concluído', 2);
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.pipelines;
ALTER TABLE public.pipelines REPLICA IDENTITY FULL;
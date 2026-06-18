ALTER TABLE public.pipeline_runs REPLICA IDENTITY FULL;
ALTER TABLE public.pipeline_run_items REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_runs; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_run_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
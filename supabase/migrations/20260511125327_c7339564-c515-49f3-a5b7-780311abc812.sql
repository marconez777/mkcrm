ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS last_reconnect_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_backfill_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_backfill_imported integer DEFAULT 0;
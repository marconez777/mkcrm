ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS session_stale_since timestamptz,
  ADD COLUMN IF NOT EXISTS last_auto_logout_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_logout_count int NOT NULL DEFAULT 0;
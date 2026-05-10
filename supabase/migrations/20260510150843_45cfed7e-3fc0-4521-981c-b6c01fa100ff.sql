ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS last_inbound_webhook_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_auto_restart_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_restart_count integer NOT NULL DEFAULT 0;
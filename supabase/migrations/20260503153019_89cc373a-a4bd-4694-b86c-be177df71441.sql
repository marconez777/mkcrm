-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- whatsapp_instances
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  evolution_url text NOT NULL,
  evolution_api_key text NOT NULL,
  evolution_instance text NOT NULL,
  webhook_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  connection_state text,
  last_health_check timestamptz,
  webhook_ok boolean,
  webhook_last_error text,
  webhook_last_set_at timestamptz,
  last_poll_at timestamptz,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='whatsapp_instances' AND policyname='public_all') THEN
    CREATE POLICY "public_all" ON public.whatsapp_instances FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_whatsapp_instances_updated_at ON public.whatsapp_instances;
CREATE TRIGGER trg_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_whatsapp_instances_default
  ON public.whatsapp_instances (is_default) WHERE is_default = true;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;

-- Backfill
DO $$
DECLARE s RECORD; new_id uuid;
BEGIN
  SELECT * INTO s FROM public.settings WHERE id = 1;
  IF s.evolution_url IS NOT NULL AND s.evolution_api_key IS NOT NULL AND s.evolution_instance IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.whatsapp_instances) THEN
      INSERT INTO public.whatsapp_instances (
        name, evolution_url, evolution_api_key, evolution_instance,
        webhook_token, connection_state, last_health_check, webhook_ok,
        webhook_last_error, webhook_last_set_at, last_poll_at, is_default
      ) VALUES (
        coalesce(s.evolution_instance, 'default'),
        s.evolution_url, s.evolution_api_key, s.evolution_instance,
        coalesce(s.webhook_token, encode(extensions.gen_random_bytes(24), 'hex')),
        s.connection_state, s.last_health_check, s.webhook_ok,
        s.webhook_last_error, s.webhook_last_set_at, s.last_poll_at, true
      ) RETURNING id INTO new_id;

      UPDATE public.leads SET whatsapp_instance_id = new_id WHERE whatsapp_instance_id IS NULL;
    END IF;
  END IF;
END $$;

-- Indexes (composite unique on lead_id+external_id matches ingestion lookup; tolerates legacy dups across leads)
CREATE INDEX IF NOT EXISTS idx_messages_lead_ts ON public.messages (lead_id, "timestamp" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_messages_lead_external
  ON public.messages (lead_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_messages_client_message_id
  ON public.messages (client_message_id) WHERE client_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_inbox ON public.leads (archived_at, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_kanban ON public.leads (stage_id, position);
CREATE INDEX IF NOT EXISTS idx_leads_instance ON public.leads (whatsapp_instance_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON public.webhook_events (received_at DESC);
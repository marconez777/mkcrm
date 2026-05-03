-- Dedup guarantee for incoming WhatsApp messages and faster reverse-pagination

CREATE UNIQUE INDEX IF NOT EXISTS messages_lead_external_uniq
  ON public.messages (lead_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_lead_ts_desc
  ON public.messages (lead_id, timestamp DESC);
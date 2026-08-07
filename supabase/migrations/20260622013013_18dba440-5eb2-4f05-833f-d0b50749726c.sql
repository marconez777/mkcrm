-- Add last_inbound_at to leads + trigger on messages + backfill
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_last_inbound_at_idx ON public.leads(last_inbound_at);

-- Backfill from messages where from_me = false
UPDATE public.leads l
SET last_inbound_at = sub.max_ts
FROM (
  SELECT lead_id, MAX(COALESCE(timestamp, created_at)) AS max_ts
  FROM public.messages
  WHERE from_me = false
  GROUP BY lead_id
) sub
WHERE l.id = sub.lead_id
  AND (l.last_inbound_at IS NULL OR l.last_inbound_at < sub.max_ts);

-- Trigger: on new inbound message, update leads.last_inbound_at
CREATE OR REPLACE FUNCTION public.update_lead_last_inbound_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.from_me = false AND NEW.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET last_inbound_at = GREATEST(
      COALESCE(last_inbound_at, '1970-01-01'::timestamptz),
      COALESCE(NEW.timestamp, NEW.created_at, now())
    )
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_update_lead_last_inbound ON public.messages;
CREATE TRIGGER trg_messages_update_lead_last_inbound
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_lead_last_inbound_at();
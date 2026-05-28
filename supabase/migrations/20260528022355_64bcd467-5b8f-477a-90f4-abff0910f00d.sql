-- 1) Trigger idempotente: só conta uma vez por linha (quando sent_at vai de NULL → preenchido)
CREATE OR REPLACE FUNCTION public.tg_email_queue_campaign_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _campaign_id uuid;
  _is_sent boolean;
  _is_failed boolean;
BEGIN
  IF NEW.related_lead_table IS NULL OR NEW.related_lead_table NOT LIKE 'campaign_%' THEN
    RETURN NEW;
  END IF;
  IF NEW.related_lead_table LIKE 'campaign_test_%' THEN
    RETURN NEW;
  END IF;

  _is_sent := NEW.status = 'sent';
  _is_failed := NEW.status = 'failed';
  IF NOT (_is_sent OR _is_failed) THEN
    RETURN NEW;
  END IF;

  -- Idempotência: só conta sent uma vez (quando sent_at é preenchido pela 1ª vez)
  IF _is_sent AND OLD.sent_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Idempotência: só conta failed quando vinha de um estado não-terminal
  IF _is_failed AND OLD.status = 'failed' THEN
    RETURN NEW;
  END IF;

  BEGIN
    _campaign_id := substring(NEW.related_lead_table from 10)::uuid;
  EXCEPTION WHEN others THEN
    RETURN NEW;
  END;

  IF _is_sent THEN
    UPDATE public.email_campaigns
       SET sent_count = COALESCE(sent_count, 0) + 1,
           last_sent_at = now(),
           updated_at = now()
     WHERE id = _campaign_id;

    INSERT INTO public.campaign_throughput (campaign_id, minute, sent, failed, updated_at)
    VALUES (_campaign_id, date_trunc('minute', now()), 1, 0, now())
    ON CONFLICT (campaign_id, minute)
    DO UPDATE SET sent = campaign_throughput.sent + 1, updated_at = now();
  ELSIF _is_failed THEN
    UPDATE public.email_campaigns
       SET failed_count = COALESCE(failed_count, 0) + 1,
           updated_at = now()
     WHERE id = _campaign_id;

    INSERT INTO public.campaign_throughput (campaign_id, minute, sent, failed, updated_at)
    VALUES (_campaign_id, date_trunc('minute', now()), 0, 1, now())
    ON CONFLICT (campaign_id, minute)
    DO UPDATE SET failed = campaign_throughput.failed + 1, updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Reconciliar sent_count/failed_count de todas as campanhas com base no estado real da fila
WITH agg AS (
  SELECT
    substring(related_lead_table from 10)::uuid AS campaign_id,
    COUNT(*) FILTER (WHERE status = 'sent')   AS sent_real,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_real
  FROM public.email_queue
  WHERE related_lead_table LIKE 'campaign_%'
    AND related_lead_table NOT LIKE 'campaign_test_%'
  GROUP BY 1
)
UPDATE public.email_campaigns c
   SET sent_count   = agg.sent_real,
       failed_count = agg.failed_real,
       updated_at   = now()
  FROM agg
 WHERE c.id = agg.campaign_id
   AND (c.sent_count IS DISTINCT FROM agg.sent_real
        OR c.failed_count IS DISTINCT FROM agg.failed_real);

-- 3) Reconciliar campaign_throughput a partir dos sent_at reais da fila
DELETE FROM public.campaign_throughput
 WHERE campaign_id IN (
   SELECT DISTINCT substring(related_lead_table from 10)::uuid
     FROM public.email_queue
    WHERE related_lead_table LIKE 'campaign_%'
      AND related_lead_table NOT LIKE 'campaign_test_%'
 );

INSERT INTO public.campaign_throughput (campaign_id, minute, sent, failed, updated_at)
SELECT
  substring(related_lead_table from 10)::uuid,
  date_trunc('minute', sent_at),
  COUNT(*) FILTER (WHERE status = 'sent'),
  0,
  now()
FROM public.email_queue
WHERE related_lead_table LIKE 'campaign_%'
  AND related_lead_table NOT LIKE 'campaign_test_%'
  AND sent_at IS NOT NULL
  AND status = 'sent'
GROUP BY 1, 2;

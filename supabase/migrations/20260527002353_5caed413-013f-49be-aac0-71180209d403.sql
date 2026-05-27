
-- 1) Nova coluna last_sent_at em email_campaigns
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;

-- 2) Tabela leve de throughput por minuto (para gráfico ao vivo)
CREATE TABLE IF NOT EXISTS public.campaign_throughput (
  campaign_id uuid NOT NULL,
  minute timestamptz NOT NULL,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, minute)
);

GRANT SELECT ON public.campaign_throughput TO authenticated;
GRANT ALL ON public.campaign_throughput TO service_role;

ALTER TABLE public.campaign_throughput ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view throughput of own clinic campaigns"
ON public.campaign_throughput
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_campaigns c
    JOIN public.clinic_members m ON m.clinic_id = c.clinic_id
    WHERE c.id = campaign_throughput.campaign_id
      AND m.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_campaign_throughput_campaign_minute
  ON public.campaign_throughput (campaign_id, minute DESC);

-- 3) Trigger function: ao mudar status para 'sent' ou 'failed' em email_queue
--    (vindo de qualquer status anterior, exceto se já estava em sent/failed),
--    incrementa email_campaigns.sent_count/failed_count + atualiza last_sent_at
--    + upsert em campaign_throughput.
CREATE OR REPLACE FUNCTION public.tg_email_queue_campaign_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _campaign_id uuid;
  _is_sent boolean;
  _is_failed boolean;
  _prev_terminal boolean;
BEGIN
  -- Só processa se related_lead_table tem o prefixo "campaign_"
  IF NEW.related_lead_table IS NULL OR NEW.related_lead_table NOT LIKE 'campaign_%' THEN
    RETURN NEW;
  END IF;
  -- Ignora contexto de teste
  IF NEW.related_lead_table LIKE 'campaign_test_%' THEN
    RETURN NEW;
  END IF;

  _is_sent := NEW.status = 'sent';
  _is_failed := NEW.status = 'failed';
  IF NOT (_is_sent OR _is_failed) THEN
    RETURN NEW;
  END IF;

  -- Se já estava no mesmo estado terminal, não recontar
  _prev_terminal := OLD.status IN ('sent','failed');
  IF _prev_terminal AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Extrai campaign_id do related_lead_table (formato campaign_<uuid>)
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
$$;

DROP TRIGGER IF EXISTS trg_email_queue_campaign_counters ON public.email_queue;
CREATE TRIGGER trg_email_queue_campaign_counters
AFTER UPDATE OF status ON public.email_queue
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.tg_email_queue_campaign_counters();

-- 4) Backfill one-shot dos counters atuais (campanhas já enviadas / em envio)
WITH agg AS (
  SELECT
    substring(eq.related_lead_table from 10)::uuid AS campaign_id,
    COUNT(*) FILTER (WHERE eq.status = 'sent') AS sent,
    COUNT(*) FILTER (WHERE eq.status = 'failed') AS failed,
    MAX(eq.sent_at) AS last_sent
  FROM public.email_queue eq
  WHERE eq.related_lead_table LIKE 'campaign_%'
    AND eq.related_lead_table NOT LIKE 'campaign_test_%'
  GROUP BY 1
)
UPDATE public.email_campaigns c
   SET sent_count = agg.sent,
       failed_count = agg.failed,
       last_sent_at = COALESCE(agg.last_sent, c.last_sent_at)
  FROM agg
 WHERE c.id = agg.campaign_id;

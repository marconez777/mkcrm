
-- 1. tracking_sites: adicionar campos do contrato bridge
ALTER TABLE public.tracking_sites
  ADD COLUMN IF NOT EXISTS data_residency     text NOT NULL DEFAULT 'local'
    CHECK (data_residency IN ('local','remote')),
  ADD COLUMN IF NOT EXISTS webhook_secret_in  text,
  ADD COLUMN IF NOT EXISTS webhook_secret_out text,
  ADD COLUMN IF NOT EXISTS journey_api_url    text;

-- 2. leads: colunas de atribuição/jornada
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ref_short     text,
  ADD COLUMN IF NOT EXISTS landing_page  text,
  ADD COLUMN IF NOT EXISTS utm_source    text,
  ADD COLUMN IF NOT EXISTS utm_medium    text,
  ADD COLUMN IF NOT EXISTS utm_campaign  text,
  ADD COLUMN IF NOT EXISTS gclid         text,
  ADD COLUMN IF NOT EXISTS fbclid        text,
  ADD COLUMN IF NOT EXISTS site_id       uuid REFERENCES public.tracking_sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_ref_short ON public.leads (ref_short);
CREATE INDEX IF NOT EXISTS idx_leads_site_id   ON public.leads (site_id);

-- 3. external_webhook_deliveries: suportar múltiplas entregas por lead + roteamento por site/type
ALTER TABLE public.external_webhook_deliveries
  DROP CONSTRAINT IF EXISTS external_webhook_deliveries_lead_id_endpoint_key;

ALTER TABLE public.external_webhook_deliveries
  ALTER COLUMN lead_id  DROP NOT NULL,
  ALTER COLUMN endpoint DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS site_id      uuid REFERENCES public.tracking_sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type         text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ewd_site_pending
  ON public.external_webhook_deliveries (site_id, status, next_attempt_at) WHERE status = 'pending';

-- 4. lead_journey_cache
CREATE TABLE IF NOT EXISTS public.lead_journey_cache (
  lead_id    uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  payload    jsonb NOT NULL
);

ALTER TABLE public.lead_journey_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journey_cache_clinic_read" ON public.lead_journey_cache;
CREATE POLICY "journey_cache_clinic_read"
  ON public.lead_journey_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_journey_cache.lead_id
        AND l.clinic_id = current_clinic_id()
    )
  );

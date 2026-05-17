-- Remove old tracking/bridge system entirely.
-- Drop columns from leads that were exclusive to tracking.
ALTER TABLE public.leads
  DROP COLUMN IF EXISTS tracking_session_id,
  DROP COLUMN IF EXISTS ref_short,
  DROP COLUMN IF EXISTS site_id,
  DROP COLUMN IF EXISTS origin_source,
  DROP COLUMN IF EXISTS origin_confidence;

-- Drop tracking + bridge tables (cascade to dependent FKs/indexes/policies).
DROP TABLE IF EXISTS public.lead_journey_cache CASCADE;
DROP TABLE IF EXISTS public.external_webhook_deliveries CASCADE;
DROP TABLE IF EXISTS public.tracking_events CASCADE;
DROP TABLE IF EXISTS public.tracking_sessions CASCADE;
DROP TABLE IF EXISTS public.tracking_sites CASCADE;
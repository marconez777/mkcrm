
-- Unschedule crons (ignore errors if missing)
DO $$ BEGIN PERFORM cron.unschedule('extractor-tick-10min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('extractor-tick-cron'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('vision-tick-cron'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('field-rules-tick-cron'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Wipe automations
DELETE FROM public.automations;

-- Drop Pipeline IA tables
DROP TABLE IF EXISTS public.pipeline_field_rules CASCADE;
DROP TABLE IF EXISTS public.stage_ai_defaults CASCADE;
DROP TABLE IF EXISTS public.lead_ai_settings CASCADE;
DROP TABLE IF EXISTS public.lead_reclassify_proposals CASCADE;
DROP TABLE IF EXISTS public.lead_reclassify_snapshot_2026_06 CASCADE;
DROP TABLE IF EXISTS public.lead_ai_extraction_runs CASCADE;

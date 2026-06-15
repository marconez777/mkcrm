
-- Onda 7 / Fase 1: higiene de lead_stage_history
-- 1) Dedupe histórico: para cada (lead_id, to_stage_id, moved_at) duplicado,
--    manter a linha com `reason` mais informativo (não-nulo > nulo, mais recente como tiebreaker).
WITH ranked AS (
  SELECT id, lead_id, to_stage_id, moved_at,
         row_number() OVER (
           PARTITION BY lead_id, to_stage_id, moved_at
           ORDER BY (CASE WHEN reason IS NOT NULL THEN 0 ELSE 1 END),
                    (CASE WHEN source IS NOT NULL THEN 0 ELSE 1 END),
                    id DESC
         ) AS rn
  FROM public.lead_stage_history
)
DELETE FROM public.lead_stage_history h
USING ranked r
WHERE h.id = r.id AND r.rn > 1;

-- 2) Backfill de source NULL como 'legacy' para auditoria
UPDATE public.lead_stage_history
SET source = 'legacy'
WHERE source IS NULL;

-- 3) source NOT NULL com default 'unknown'
ALTER TABLE public.lead_stage_history
  ALTER COLUMN source SET DEFAULT 'unknown',
  ALTER COLUMN source SET NOT NULL;

-- 4) Índice único parcial para impedir duplicação futura no mesmo segundo
CREATE UNIQUE INDEX IF NOT EXISTS lead_stage_history_dedup_uidx
  ON public.lead_stage_history (lead_id, to_stage_id, moved_at);

-- 5) Refatorar o trigger record_lead_stage_history para ser idempotente.
--    Se já existe linha pro mesmo (lead, to_stage, moved_at) — porque outra função
--    INSERTou explicitamente antes do trigger disparar — não cria duplicata.
CREATE OR REPLACE FUNCTION public.record_lead_stage_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.lead_stage_history
      (clinic_id, lead_id, from_stage_id, to_stage_id, moved_by_user_id, source, metadata)
    VALUES (
      NEW.clinic_id, NEW.id, OLD.stage_id, NEW.stage_id, v_user,
      CASE WHEN v_user IS NOT NULL THEN 'manual' ELSE 'system' END,
      '{}'::jsonb
    )
    ON CONFLICT (lead_id, to_stage_id, moved_at) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- 6) Índice para queries de auditoria por source/data
CREATE INDEX IF NOT EXISTS lead_stage_history_source_movedat_idx
  ON public.lead_stage_history (source, moved_at DESC);

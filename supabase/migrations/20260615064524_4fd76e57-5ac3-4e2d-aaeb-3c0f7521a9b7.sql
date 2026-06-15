
-- B7: rastreabilidade de quem moveu o card
ALTER TABLE public.lead_stage_history
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_lead_stage_history_source
  ON public.lead_stage_history (source) WHERE source IS NOT NULL;

-- Atualiza trigger: preenche source automaticamente em drag manual
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
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- B20: coluna de atividade humana real
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_human_activity_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_last_human_activity
  ON public.leads (clinic_id, last_human_activity_at DESC NULLS LAST);

-- Trigger: messages que contam como atividade humana
CREATE OR REPLACE FUNCTION public.bump_lead_last_human_activity_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Conta: inbound (from_me=false) OU outbound humano (from_me=true E NOT is_auto_reply)
  IF NEW.from_me = false OR COALESCE(NEW.is_auto_reply, false) = false THEN
    UPDATE public.leads
       SET last_human_activity_at = GREATEST(
             COALESCE(last_human_activity_at, 'epoch'::timestamptz),
             COALESCE(NEW.timestamp, now())
           )
     WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bump_human_activity_from_msg ON public.messages;
CREATE TRIGGER trg_bump_human_activity_from_msg
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_lead_last_human_activity_from_message();

-- Trigger: notas internas também contam
CREATE OR REPLACE FUNCTION public.bump_lead_last_human_activity_from_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.leads
     SET last_human_activity_at = GREATEST(
           COALESCE(last_human_activity_at, 'epoch'::timestamptz),
           now()
         )
   WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bump_human_activity_from_note ON public.lead_internal_notes;
CREATE TRIGGER trg_bump_human_activity_from_note
  AFTER INSERT ON public.lead_internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.bump_lead_last_human_activity_from_note();

-- Backfill: maior timestamp de messages "humanas" por lead
UPDATE public.leads l
   SET last_human_activity_at = sub.max_ts
  FROM (
    SELECT lead_id, MAX(timestamp) AS max_ts
      FROM public.messages
     WHERE from_me = false OR COALESCE(is_auto_reply, false) = false
     GROUP BY lead_id
  ) sub
 WHERE sub.lead_id = l.id
   AND l.last_human_activity_at IS NULL;

-- B13: detecção de leads duplicados por telefone normalizado
CREATE OR REPLACE FUNCTION public.find_duplicate_leads_by_phone(p_clinic_id uuid)
RETURNS TABLE (
  normalized_phone text,
  lead_count bigint,
  lead_ids uuid[],
  names text[],
  stage_ids uuid[],
  last_message_ats timestamptz[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    regexp_replace(coalesce(phone,''), '\D', '', 'g') AS normalized_phone,
    count(*) AS lead_count,
    array_agg(id ORDER BY created_at) AS lead_ids,
    array_agg(coalesce(name,'(sem nome)') ORDER BY created_at) AS names,
    array_agg(stage_id ORDER BY created_at) AS stage_ids,
    array_agg(last_message_at ORDER BY created_at) AS last_message_ats
  FROM public.leads
  WHERE clinic_id = p_clinic_id
    AND archived_at IS NULL
    AND phone IS NOT NULL
    AND length(regexp_replace(phone,'\D','','g')) >= 10
  GROUP BY 1
  HAVING count(*) > 1;
$function$;

GRANT EXECUTE ON FUNCTION public.find_duplicate_leads_by_phone(uuid) TO authenticated, service_role;

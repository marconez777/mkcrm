
-- 1. Coluna jsonb com timestamps de últimas edições humanas por chave
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS custom_fields_last_human_edit jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Trigger: marca chaves modificadas como human-edited, exceto quando app.actor='system'
CREATE OR REPLACE FUNCTION public.track_custom_fields_human_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor text;
  k text;
  old_val jsonb;
  new_val jsonb;
  now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
BEGIN
  IF NEW.custom_fields IS NOT DISTINCT FROM OLD.custom_fields THEN
    RETURN NEW;
  END IF;

  BEGIN
    actor := current_setting('app.actor', true);
  EXCEPTION WHEN OTHERS THEN
    actor := NULL;
  END;

  IF actor = 'system' THEN
    RETURN NEW;
  END IF;

  FOR k IN
    SELECT t.key FROM jsonb_object_keys(
      COALESCE(NEW.custom_fields, '{}'::jsonb) || COALESCE(OLD.custom_fields, '{}'::jsonb)
    ) AS t(key)
  LOOP
    old_val := COALESCE(OLD.custom_fields, '{}'::jsonb) -> k;
    new_val := COALESCE(NEW.custom_fields, '{}'::jsonb) -> k;
    IF old_val IS DISTINCT FROM new_val THEN
      NEW.custom_fields_last_human_edit :=
        COALESCE(NEW.custom_fields_last_human_edit, '{}'::jsonb)
        || jsonb_build_object(k, now_iso);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_custom_fields_human_edits ON public.leads;
CREATE TRIGGER trg_track_custom_fields_human_edits
BEFORE UPDATE OF custom_fields ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.track_custom_fields_human_edits();

-- 3. RPC para o classificador IA aplicar patch sem disparar G10 nele mesmo.
--    Roda dentro de uma transação, seta app.actor=system, aplica UPDATE, retorna.
CREATE OR REPLACE FUNCTION public.apply_lead_automation_patch(
  p_lead_id uuid,
  p_custom_fields jsonb DEFAULT NULL,
  p_tags text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.actor', 'system', true);
  UPDATE public.leads
  SET
    custom_fields = COALESCE(p_custom_fields, custom_fields),
    tags          = COALESCE(p_tags, tags)
  WHERE id = p_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_lead_automation_patch(uuid, jsonb, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_lead_automation_patch(uuid, jsonb, text[]) TO service_role;

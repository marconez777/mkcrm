-- Avalia se um lead bate com os filtros de um segmento (tags, stage_id, stage_ids, has_email)
CREATE OR REPLACE FUNCTION public.lead_matches_segment(_lead_id uuid, _segment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _f JSONB;
  _lead RECORD;
  _tags TEXT[];
  _stage_ids UUID[];
  _stage_id UUID;
BEGIN
  IF _segment_id IS NULL THEN RETURN TRUE; END IF;

  SELECT filters INTO _f FROM public.email_segments WHERE id = _segment_id;
  IF _f IS NULL OR _f = '{}'::jsonb THEN RETURN TRUE; END IF;

  SELECT id, email, tags, stage_id INTO _lead FROM public.leads WHERE id = _lead_id;
  IF _lead.id IS NULL THEN RETURN FALSE; END IF;

  -- has_email
  IF (_f->>'has_email')::boolean IS TRUE THEN
    IF _lead.email IS NULL OR _lead.email = '' THEN RETURN FALSE; END IF;
  END IF;

  -- tags (overlap)
  IF jsonb_typeof(_f->'tags') = 'array' AND jsonb_array_length(_f->'tags') > 0 THEN
    SELECT array_agg(value::text) INTO _tags FROM jsonb_array_elements_text(_f->'tags');
    IF NOT (_lead.tags && _tags) THEN RETURN FALSE; END IF;
  END IF;

  -- stage_ids (in)
  IF jsonb_typeof(_f->'stage_ids') = 'array' AND jsonb_array_length(_f->'stage_ids') > 0 THEN
    SELECT array_agg((value::text)::uuid) INTO _stage_ids FROM jsonb_array_elements_text(_f->'stage_ids');
    IF _lead.stage_id IS NULL OR NOT (_lead.stage_id = ANY(_stage_ids)) THEN RETURN FALSE; END IF;
  END IF;

  -- stage_id (singular)
  IF _f ? 'stage_id' AND (_f->>'stage_id') IS NOT NULL AND (_f->>'stage_id') <> '' THEN
    _stage_id := (_f->>'stage_id')::uuid;
    IF _lead.stage_id IS DISTINCT FROM _stage_id THEN RETURN FALSE; END IF;
  END IF;

  RETURN TRUE;
END $$;

-- Trigger: lead_created — agora respeita trigger_config.segment_id
CREATE OR REPLACE FUNCTION public.tg_email_on_lead_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  auto RECORD;
  step JSONB;
  delay_days NUMERIC;
  template_slug TEXT;
  _segment_id UUID;
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN RETURN NEW; END IF;
  IF NOT public.clinic_has_feature(NEW.clinic_id, 'email_marketing') THEN RETURN NEW; END IF;

  FOR auto IN
    SELECT id, steps, trigger_config FROM public.email_automations
    WHERE clinic_id = NEW.clinic_id
      AND active = true
      AND trigger_type = 'lead_created'
  LOOP
    _segment_id := NULLIF(auto.trigger_config->>'segment_id','')::uuid;
    IF _segment_id IS NOT NULL AND NOT public.lead_matches_segment(NEW.id, _segment_id) THEN
      CONTINUE;
    END IF;

    FOR step IN SELECT * FROM jsonb_array_elements(auto.steps)
    LOOP
      template_slug := step->>'template_slug';
      delay_days := COALESCE((step->>'delay_days')::numeric, (step->>'delay_minutes')::numeric / 1440.0, 0);
      IF template_slug IS NULL THEN CONTINUE; END IF;
      PERFORM public.enqueue_email(
        NEW.clinic_id,
        template_slug,
        NEW.email,
        NEW.name,
        jsonb_build_object('name', NEW.name, 'lead_id', NEW.id, 'automation_id', auto.id),
        now() + (delay_days || ' days')::interval,
        NEW.id,
        'auto_' || auto.id::text,
        false
      );
    END LOOP;
  END LOOP;
  RETURN NEW;
END $$;

-- Trigger: stage_change — agora respeita trigger_config.segment_id
CREATE OR REPLACE FUNCTION public.tg_email_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  auto RECORD;
  step JSONB;
  delay_days NUMERIC;
  template_slug TEXT;
  _segment_id UUID;
BEGIN
  IF NEW.stage_id IS NULL OR NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;
  IF NEW.email IS NULL OR NEW.email = '' THEN RETURN NEW; END IF;
  IF NOT public.clinic_has_feature(NEW.clinic_id, 'email_marketing') THEN RETURN NEW; END IF;

  FOR auto IN
    SELECT id, steps, trigger_config FROM public.email_automations
    WHERE clinic_id = NEW.clinic_id
      AND active = true
      AND trigger_type IN ('stage_enter','lead_stage_changed')
      AND (
        (trigger_config->>'stage_id') IS NULL
        OR (trigger_config->>'stage_id')::uuid = NEW.stage_id
      )
  LOOP
    _segment_id := NULLIF(auto.trigger_config->>'segment_id','')::uuid;
    IF _segment_id IS NOT NULL AND NOT public.lead_matches_segment(NEW.id, _segment_id) THEN
      CONTINUE;
    END IF;

    FOR step IN SELECT * FROM jsonb_array_elements(auto.steps)
    LOOP
      template_slug := step->>'template_slug';
      delay_days := COALESCE((step->>'delay_days')::numeric, (step->>'delay_minutes')::numeric / 1440.0, 0);
      IF template_slug IS NULL THEN CONTINUE; END IF;
      PERFORM public.enqueue_email(
        NEW.clinic_id,
        template_slug,
        NEW.email,
        NEW.name,
        jsonb_build_object('name', NEW.name, 'lead_id', NEW.id, 'automation_id', auto.id),
        now() + (delay_days || ' days')::interval,
        NEW.id,
        'auto_' || auto.id::text,
        false
      );
    END LOOP;
  END LOOP;
  RETURN NEW;
END $$;
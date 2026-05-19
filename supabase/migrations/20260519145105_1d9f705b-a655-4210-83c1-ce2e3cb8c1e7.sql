
-- 1) form_source nos leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS form_source text;
CREATE INDEX IF NOT EXISTS leads_form_source_idx ON public.leads (clinic_id, form_source) WHERE form_source IS NOT NULL;

-- 2) email_segment_contacts: contatos manuais (estáticos ou inclusões extras)
CREATE TABLE IF NOT EXISTS public.email_segment_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  segment_id uuid NOT NULL REFERENCES public.email_segments(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  lead_id uuid,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (segment_id, email)
);
CREATE INDEX IF NOT EXISTS esc_clinic_idx ON public.email_segment_contacts(clinic_id);
CREATE INDEX IF NOT EXISTS esc_segment_idx ON public.email_segment_contacts(segment_id);

ALTER TABLE public.email_segment_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS esc_clinic ON public.email_segment_contacts;
CREATE POLICY esc_clinic ON public.email_segment_contacts
  FOR ALL TO authenticated
  USING (has_clinic_access(clinic_id) AND clinic_has_feature(clinic_id, 'email_marketing'))
  WITH CHECK (has_clinic_access(clinic_id) AND clinic_has_feature(clinic_id, 'email_marketing'));

-- 3) resolve_email_segment(segment_id) → (email, name, lead_id)
CREATE OR REPLACE FUNCTION public.resolve_email_segment(_segment_id uuid)
RETURNS TABLE(email text, name text, lead_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seg public.email_segments%ROWTYPE;
  _f jsonb;
  _kind text;
  _rules jsonb;
  _rule jsonb;
  _where text := '';
  _parts text[] := ARRAY[]::text[];
  _values jsonb;
  _qry text;
BEGIN
  SELECT * INTO _seg FROM public.email_segments WHERE id = _segment_id;
  IF _seg.id IS NULL THEN RETURN; END IF;
  IF NOT has_clinic_access(_seg.clinic_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _f := COALESCE(_seg.filters, '{}'::jsonb);
  _kind := COALESCE(_f->>'kind', 'dynamic');
  _rules := COALESCE(_f->'rules', '[]'::jsonb);

  IF _kind = 'dynamic' THEN
    -- Backward compat: filtro antigo {tags|stage_id|stage_ids|has_email}
    IF jsonb_array_length(_rules) = 0 AND (_f ? 'tags' OR _f ? 'stage_id' OR _f ? 'stage_ids' OR _f ? 'has_email') THEN
      _rules := '[]'::jsonb;
      IF jsonb_typeof(_f->'tags') = 'array' AND jsonb_array_length(_f->'tags') > 0 THEN
        _rules := _rules || jsonb_build_array(jsonb_build_object('type','tag','values',_f->'tags'));
      END IF;
      IF (_f->>'has_email')::boolean IS TRUE THEN
        _rules := _rules || jsonb_build_array(jsonb_build_object('type','has_email'));
      END IF;
      IF jsonb_typeof(_f->'stage_ids') = 'array' AND jsonb_array_length(_f->'stage_ids') > 0 THEN
        FOR _rule IN SELECT * FROM jsonb_array_elements(_f->'stage_ids') LOOP
          _rules := _rules || jsonb_build_array(jsonb_build_object('type','stage','stage_id',_rule));
        END LOOP;
      END IF;
      IF _f ? 'stage_id' AND (_f->>'stage_id') <> '' THEN
        _rules := _rules || jsonb_build_array(jsonb_build_object('type','stage','stage_id',_f->>'stage_id'));
      END IF;
    END IF;

    -- Build OR conditions
    FOR _rule IN SELECT * FROM jsonb_array_elements(_rules) LOOP
      IF _rule->>'type' = 'form_source' AND jsonb_typeof(_rule->'values') = 'array' AND jsonb_array_length(_rule->'values') > 0 THEN
        _parts := _parts || ('form_source = ANY(ARRAY(SELECT jsonb_array_elements_text('|| quote_literal(_rule->'values') ||'::jsonb)))');
      ELSIF _rule->>'type' = 'tag' AND jsonb_typeof(_rule->'values') = 'array' AND jsonb_array_length(_rule->'values') > 0 THEN
        _parts := _parts || ('tags && ARRAY(SELECT jsonb_array_elements_text('|| quote_literal(_rule->'values') ||'::jsonb))');
      ELSIF _rule->>'type' = 'stage' AND (_rule->>'stage_id') IS NOT NULL THEN
        _parts := _parts || ('stage_id = '|| quote_literal(_rule->>'stage_id') ||'::uuid');
      ELSIF _rule->>'type' = 'has_email' THEN
        _parts := _parts || '(email IS NOT NULL AND email <> '''')';
      ELSIF _rule->>'type' = 'utm_campaign' AND jsonb_typeof(_rule->'values') = 'array' AND jsonb_array_length(_rule->'values') > 0 THEN
        _parts := _parts || ('utm_campaign = ANY(ARRAY(SELECT jsonb_array_elements_text('|| quote_literal(_rule->'values') ||'::jsonb)))');
      END IF;
    END LOOP;

    IF array_length(_parts,1) IS NULL THEN
      _where := 'TRUE';
    ELSE
      _where := '(' || array_to_string(_parts, ' OR ') || ')';
    END IF;

    _qry := format(
      'SELECT lower(email)::text AS email, name::text, id AS lead_id FROM public.leads
       WHERE clinic_id = %L AND email IS NOT NULL AND email <> '''' AND %s',
      _seg.clinic_id, _where
    );
    RETURN QUERY EXECUTE _qry;
  END IF;

  -- União com contatos manuais (sempre, mesmo se dynamic)
  RETURN QUERY
    SELECT lower(c.email)::text AS email, c.name::text, c.lead_id
    FROM public.email_segment_contacts c
    WHERE c.segment_id = _segment_id;
END $$;

REVOKE ALL ON FUNCTION public.resolve_email_segment(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_email_segment(uuid) TO authenticated, service_role;

-- 4) Atualiza lead_matches_segment para entender rules[] (OR)
CREATE OR REPLACE FUNCTION public.lead_matches_segment(_lead_id uuid, _segment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _f jsonb;
  _kind text;
  _rules jsonb;
  _rule jsonb;
  _lead RECORD;
  _values text[];
BEGIN
  IF _segment_id IS NULL THEN RETURN TRUE; END IF;
  SELECT filters INTO _f FROM public.email_segments WHERE id = _segment_id;
  IF _f IS NULL OR _f = '{}'::jsonb THEN RETURN TRUE; END IF;

  _kind := COALESCE(_f->>'kind','dynamic');
  _rules := COALESCE(_f->'rules', '[]'::jsonb);

  -- Estático: só matchea se houver na lista
  IF _kind = 'static' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.email_segment_contacts c
      JOIN public.leads l ON l.id = _lead_id
      WHERE c.segment_id = _segment_id
        AND lower(c.email) = lower(l.email)
    );
  END IF;

  SELECT id, email, tags, stage_id, form_source, utm_campaign INTO _lead
  FROM public.leads WHERE id = _lead_id;
  IF _lead.id IS NULL THEN RETURN FALSE; END IF;

  -- Backcompat (filtros antigos: AND entre eles) — mantém comportamento prévio se não tem rules[]
  IF jsonb_array_length(_rules) = 0 THEN
    IF (_f->>'has_email')::boolean IS TRUE THEN
      IF _lead.email IS NULL OR _lead.email = '' THEN RETURN FALSE; END IF;
    END IF;
    IF jsonb_typeof(_f->'tags') = 'array' AND jsonb_array_length(_f->'tags') > 0 THEN
      SELECT array_agg(value::text) INTO _values FROM jsonb_array_elements_text(_f->'tags');
      IF NOT (_lead.tags && _values) THEN RETURN FALSE; END IF;
    END IF;
    IF _f ? 'stage_id' AND (_f->>'stage_id') <> '' THEN
      IF _lead.stage_id IS DISTINCT FROM (_f->>'stage_id')::uuid THEN RETURN FALSE; END IF;
    END IF;
    RETURN TRUE;
  END IF;

  -- Novo formato: OR entre rules
  FOR _rule IN SELECT * FROM jsonb_array_elements(_rules) LOOP
    IF _rule->>'type' = 'form_source' AND jsonb_typeof(_rule->'values') = 'array' THEN
      SELECT array_agg(value::text) INTO _values FROM jsonb_array_elements_text(_rule->'values');
      IF _lead.form_source = ANY(_values) THEN RETURN TRUE; END IF;
    ELSIF _rule->>'type' = 'tag' AND jsonb_typeof(_rule->'values') = 'array' THEN
      SELECT array_agg(value::text) INTO _values FROM jsonb_array_elements_text(_rule->'values');
      IF _lead.tags && _values THEN RETURN TRUE; END IF;
    ELSIF _rule->>'type' = 'stage' AND (_rule->>'stage_id') IS NOT NULL THEN
      IF _lead.stage_id = (_rule->>'stage_id')::uuid THEN RETURN TRUE; END IF;
    ELSIF _rule->>'type' = 'has_email' THEN
      IF _lead.email IS NOT NULL AND _lead.email <> '' THEN RETURN TRUE; END IF;
    ELSIF _rule->>'type' = 'utm_campaign' AND jsonb_typeof(_rule->'values') = 'array' THEN
      SELECT array_agg(value::text) INTO _values FROM jsonb_array_elements_text(_rule->'values');
      IF _lead.utm_campaign = ANY(_values) THEN RETURN TRUE; END IF;
    END IF;
  END LOOP;
  RETURN FALSE;
END $$;

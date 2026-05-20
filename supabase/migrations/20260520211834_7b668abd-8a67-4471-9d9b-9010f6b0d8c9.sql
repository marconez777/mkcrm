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
  _qry text;
BEGIN
  SELECT * INTO _seg FROM public.email_segments WHERE id = _segment_id;
  IF _seg.id IS NULL THEN RETURN; END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT has_clinic_access(_seg.clinic_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _f := COALESCE(_seg.filters, '{}'::jsonb);
  _kind := COALESCE(_f->>'kind', 'dynamic');
  _rules := COALESCE(_f->'rules', '[]'::jsonb);

  IF _kind = 'dynamic' THEN
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

  RETURN QUERY
    SELECT lower(c.email)::text AS email, c.name::text, c.lead_id
    FROM public.email_segment_contacts c
    WHERE c.segment_id = _segment_id;
END $$;

REVOKE ALL ON FUNCTION public.resolve_email_segment(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_email_segment(uuid) TO authenticated, service_role;
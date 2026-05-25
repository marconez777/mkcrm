
-- Helper that builds a SQL WHERE part from a rule jsonb
CREATE OR REPLACE FUNCTION public._email_segment_rule_to_sql(_rule jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  _t text := _rule->>'type';
  _part text := NULL;
  _neg boolean := COALESCE((_rule->>'negate')::boolean, false);
BEGIN
  IF _t = 'form_source' AND jsonb_typeof(_rule->'values') = 'array' AND jsonb_array_length(_rule->'values') > 0 THEN
    _part := 'form_source = ANY(ARRAY(SELECT jsonb_array_elements_text('|| quote_literal(_rule->'values') ||'::jsonb)))';
  ELSIF _t = 'tag' AND jsonb_typeof(_rule->'values') = 'array' AND jsonb_array_length(_rule->'values') > 0 THEN
    _part := 'tags && ARRAY(SELECT jsonb_array_elements_text('|| quote_literal(_rule->'values') ||'::jsonb))';
  ELSIF _t = 'stage' AND (_rule->>'stage_id') IS NOT NULL AND (_rule->>'stage_id') <> '' THEN
    _part := 'stage_id = '|| quote_literal(_rule->>'stage_id') ||'::uuid';
  ELSIF _t = 'has_email' THEN
    _part := '(email IS NOT NULL AND email <> '''')';
  ELSIF _t = 'utm_campaign' AND jsonb_typeof(_rule->'values') = 'array' AND jsonb_array_length(_rule->'values') > 0 THEN
    _part := 'utm_campaign = ANY(ARRAY(SELECT jsonb_array_elements_text('|| quote_literal(_rule->'values') ||'::jsonb)))';
  ELSIF _t = 'created_at_range' THEN
    DECLARE
      _from text := _rule->>'from';
      _to text := _rule->>'to';
      _conds text[] := ARRAY[]::text[];
    BEGIN
      IF _from IS NOT NULL AND _from <> '' THEN
        _conds := _conds || ('created_at >= '|| quote_literal(_from) ||'::timestamptz');
      END IF;
      IF _to IS NOT NULL AND _to <> '' THEN
        _conds := _conds || ('created_at <= '|| quote_literal(_to) ||'::timestamptz');
      END IF;
      IF array_length(_conds, 1) IS NOT NULL THEN
        _part := '(' || array_to_string(_conds, ' AND ') || ')';
      END IF;
    END;
  END IF;

  IF _part IS NULL THEN
    RETURN NULL;
  END IF;

  IF _neg THEN
    RETURN 'NOT (' || _part || ')';
  END IF;
  RETURN _part;
END;
$$;

-- Build SQL WHERE from filters jsonb
CREATE OR REPLACE FUNCTION public._email_segment_filters_to_where(_filters jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  _rules jsonb := COALESCE(_filters->'rules', '[]'::jsonb);
  _match text := COALESCE(_filters->>'match', 'any');
  _rule jsonb;
  _parts text[] := ARRAY[]::text[];
  _p text;
  _joiner text;
BEGIN
  -- backward compat: legacy keys
  IF jsonb_array_length(_rules) = 0 AND (_filters ? 'tags' OR _filters ? 'stage_id' OR _filters ? 'stage_ids' OR _filters ? 'has_email') THEN
    _rules := '[]'::jsonb;
    IF jsonb_typeof(_filters->'tags') = 'array' AND jsonb_array_length(_filters->'tags') > 0 THEN
      _rules := _rules || jsonb_build_array(jsonb_build_object('type','tag','values',_filters->'tags'));
    END IF;
    IF (_filters->>'has_email')::boolean IS TRUE THEN
      _rules := _rules || jsonb_build_array(jsonb_build_object('type','has_email'));
    END IF;
    IF jsonb_typeof(_filters->'stage_ids') = 'array' THEN
      FOR _rule IN SELECT * FROM jsonb_array_elements(_filters->'stage_ids') LOOP
        _rules := _rules || jsonb_build_array(jsonb_build_object('type','stage','stage_id',_rule));
      END LOOP;
    END IF;
    IF _filters ? 'stage_id' AND (_filters->>'stage_id') <> '' THEN
      _rules := _rules || jsonb_build_array(jsonb_build_object('type','stage','stage_id',_filters->>'stage_id'));
    END IF;
  END IF;

  FOR _rule IN SELECT * FROM jsonb_array_elements(_rules) LOOP
    _p := public._email_segment_rule_to_sql(_rule);
    IF _p IS NOT NULL THEN
      _parts := _parts || _p;
    END IF;
  END LOOP;

  IF array_length(_parts,1) IS NULL THEN
    RETURN 'TRUE';
  END IF;

  _joiner := CASE WHEN lower(_match) = 'all' THEN ' AND ' ELSE ' OR ' END;
  RETURN '(' || array_to_string(_parts, _joiner) || ')';
END;
$$;

-- Update resolver to use shared helpers + match ALL + negate
CREATE OR REPLACE FUNCTION public.resolve_email_segment(_segment_id uuid)
RETURNS TABLE(email text, name text, lead_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _seg public.email_segments%ROWTYPE;
  _f jsonb;
  _kind text;
  _where text;
  _qry text;
BEGIN
  SELECT * INTO _seg FROM public.email_segments WHERE id = _segment_id;
  IF _seg.id IS NULL THEN RETURN; END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT has_clinic_access(_seg.clinic_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _f := COALESCE(_seg.filters, '{}'::jsonb);
  _kind := COALESCE(_f->>'kind', 'dynamic');

  IF _kind = 'dynamic' THEN
    _where := public._email_segment_filters_to_where(_f);
    _qry := format(
      'SELECT lower(email)::text AS email, name::text, id AS lead_id FROM public.leads
       WHERE clinic_id = %L AND email IS NOT NULL AND email <> '''' AND %s',
      _seg.clinic_id, _where
    );
    RETURN QUERY EXECUTE _qry;
  END IF;

  RETURN QUERY
    SELECT lower(c.email)::text, c.name::text, NULL::uuid
    FROM public.email_segment_contacts c
    WHERE c.segment_id = _segment_id AND c.email IS NOT NULL;
END;
$$;

-- Dry-run preview function (no segment row needed)
CREATE OR REPLACE FUNCTION public.resolve_email_segment_preview(
  _clinic_id uuid,
  _filters jsonb
)
RETURNS TABLE(email text, name text, lead_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _where text;
  _qry text;
BEGIN
  IF NOT has_clinic_access(_clinic_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _where := public._email_segment_filters_to_where(COALESCE(_filters, '{}'::jsonb));
  _qry := format(
    'SELECT lower(email)::text AS email, name::text, id AS lead_id FROM public.leads
     WHERE clinic_id = %L AND email IS NOT NULL AND email <> '''' AND %s
     LIMIT 5000',
    _clinic_id, _where
  );
  RETURN QUERY EXECUTE _qry;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_email_segment_preview(uuid, jsonb) TO authenticated;

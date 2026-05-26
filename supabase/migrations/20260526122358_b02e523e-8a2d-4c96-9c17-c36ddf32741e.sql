
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS send_rate_per_minute integer,
  ADD COLUMN IF NOT EXISTS from_domain_pool text,
  ADD COLUMN IF NOT EXISTS variant_strategy text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS winner_picked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.email_campaign_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  label text NOT NULL,
  weight integer NOT NULL DEFAULT 1 CHECK (weight > 0),
  subject_override text,
  template_slug_override text,
  from_name_override text,
  sent_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_campaign_variants_campaign_idx
  ON public.email_campaign_variants(campaign_id);

ALTER TABLE public.email_campaign_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS variants_clinic_read ON public.email_campaign_variants;
CREATE POLICY variants_clinic_read ON public.email_campaign_variants
  FOR SELECT TO authenticated
  USING (has_clinic_access(clinic_id));

DROP POLICY IF EXISTS variants_clinic_write ON public.email_campaign_variants;
CREATE POLICY variants_clinic_write ON public.email_campaign_variants
  FOR ALL TO authenticated
  USING (
    has_clinic_access(clinic_id)
    AND EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.clinic_id = email_campaign_variants.clinic_id
        AND cm.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    has_clinic_access(clinic_id)
    AND EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.clinic_id = email_campaign_variants.clinic_id
        AND cm.role IN ('owner','admin')
    )
  );

ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS variant_id uuid,
  ADD COLUMN IF NOT EXISTS from_domain_override text;

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS variant_id uuid,
  ADD COLUMN IF NOT EXISTS from_domain_override text;

CREATE INDEX IF NOT EXISTS email_logs_variant_idx
  ON public.email_logs(variant_id) WHERE variant_id IS NOT NULL;

ALTER TABLE public.email_domains
  ADD COLUMN IF NOT EXISTS rotation_pool text,
  ADD COLUMN IF NOT EXISTS rotation_weight integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS email_domains_pool_idx
  ON public.email_domains(clinic_id, rotation_pool) WHERE rotation_pool IS NOT NULL;

CREATE OR REPLACE FUNCTION public.pick_rotation_domain(_clinic_id uuid, _pool text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _r text;
BEGIN
  IF _pool IS NULL OR _pool = '' THEN RETURN NULL; END IF;
  SELECT domain INTO _r
  FROM public.email_domains
  WHERE clinic_id = _clinic_id
    AND rotation_pool = _pool
    AND status IN ('verified','partially_verified')
  ORDER BY (-ln(1 - random()) / GREATEST(rotation_weight, 1)) ASC
  LIMIT 1;
  RETURN _r;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pick_rotation_domain(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pick_ab_winner(_campaign_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _wid uuid;
  _clinic uuid;
BEGIN
  SELECT clinic_id INTO _clinic FROM public.email_campaigns WHERE id = _campaign_id;
  IF _clinic IS NULL THEN RETURN NULL; END IF;
  IF COALESCE(auth.role(),'') <> 'service_role' AND NOT has_clinic_access(_clinic) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.email_campaign_variants v SET
    sent_count    = COALESCE((SELECT count(*) FROM public.email_logs l WHERE l.variant_id = v.id), 0),
    opened_count  = COALESCE((SELECT count(*) FROM public.email_logs l WHERE l.variant_id = v.id AND l.opened_at  IS NOT NULL), 0),
    clicked_count = COALESCE((SELECT count(*) FROM public.email_logs l WHERE l.variant_id = v.id AND l.clicked_at IS NOT NULL), 0),
    updated_at    = now()
  WHERE campaign_id = _campaign_id;

  SELECT id INTO _wid
  FROM public.email_campaign_variants
  WHERE campaign_id = _campaign_id AND sent_count > 0
  ORDER BY (opened_count::float / NULLIF(sent_count,0)) DESC NULLS LAST,
           opened_count DESC
  LIMIT 1;

  IF _wid IS NOT NULL THEN
    UPDATE public.email_campaign_variants
       SET is_winner = (id = _wid), updated_at = now()
     WHERE campaign_id = _campaign_id;
    UPDATE public.email_campaigns
       SET winner_picked_at = now(), updated_at = now()
     WHERE id = _campaign_id;
  END IF;

  RETURN _wid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pick_ab_winner(uuid) TO authenticated, service_role;

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
  ELSIF _t = 'last_message_at_range' THEN
    DECLARE
      _from text := _rule->>'from';
      _to text := _rule->>'to';
      _conds text[] := ARRAY[]::text[];
    BEGIN
      IF _from IS NOT NULL AND _from <> '' THEN
        _conds := _conds || ('last_message_at >= '|| quote_literal(_from) ||'::timestamptz');
      END IF;
      IF _to IS NOT NULL AND _to <> '' THEN
        _conds := _conds || ('last_message_at <= '|| quote_literal(_to) ||'::timestamptz');
      END IF;
      IF array_length(_conds, 1) IS NOT NULL THEN
        _part := '(' || array_to_string(_conds, ' AND ') || ')';
      END IF;
    END;
  ELSIF _t = 'deal_value_range' THEN
    DECLARE
      _min text := _rule->>'min';
      _max text := _rule->>'max';
      _conds text[] := ARRAY[]::text[];
    BEGIN
      IF _min IS NOT NULL AND _min <> '' THEN
        _conds := _conds || ('deal_value >= '|| quote_literal(_min) ||'::numeric');
      END IF;
      IF _max IS NOT NULL AND _max <> '' THEN
        _conds := _conds || ('deal_value <= '|| quote_literal(_max) ||'::numeric');
      END IF;
      IF array_length(_conds, 1) IS NOT NULL THEN
        _part := '(' || array_to_string(_conds, ' AND ') || ')';
      END IF;
    END;
  ELSIF _t = 'custom_field' AND (_rule->>'key') IS NOT NULL AND (_rule->>'key') <> '' THEN
    DECLARE
      _key text := _rule->>'key';
      _val text := _rule->>'value';
    BEGIN
      IF jsonb_typeof(_rule->'values') = 'array' AND jsonb_array_length(_rule->'values') > 0 THEN
        _part := format('(custom_fields->>%L) = ANY(ARRAY(SELECT jsonb_array_elements_text(%L::jsonb)))',
                        _key, (_rule->'values')::text);
      ELSIF _val IS NOT NULL THEN
        _part := format('(custom_fields->>%L) = %L', _key, _val);
      ELSE
        _part := format('(custom_fields ? %L)', _key);
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

DROP TRIGGER IF EXISTS trg_email_campaign_variants_updated_at ON public.email_campaign_variants;
CREATE TRIGGER trg_email_campaign_variants_updated_at
  BEFORE UPDATE ON public.email_campaign_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

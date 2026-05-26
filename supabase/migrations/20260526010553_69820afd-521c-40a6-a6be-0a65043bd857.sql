
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS from_name_override TEXT;
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS from_name_override TEXT;

CREATE OR REPLACE FUNCTION public.enqueue_email(
  _clinic_id uuid,
  _template_slug text,
  _recipient_email text,
  _recipient_name text DEFAULT NULL::text,
  _variables jsonb DEFAULT '{}'::jsonb,
  _scheduled_at timestamp with time zone DEFAULT now(),
  _related_lead_id uuid DEFAULT NULL::uuid,
  _related_lead_table text DEFAULT NULL::text,
  _force_send boolean DEFAULT false,
  _from_name_override text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _id UUID; _email_lower TEXT := lower(_recipient_email);
BEGIN
  IF NOT public.clinic_has_feature(_clinic_id, 'email_marketing') THEN
    RETURN NULL;
  END IF;

  IF _related_lead_table IS NOT NULL AND _related_lead_table <> 'leads_internal' THEN
    IF EXISTS (
      SELECT 1 FROM public.email_queue
      WHERE clinic_id = _clinic_id
        AND template_slug = _template_slug
        AND lower(recipient_email) = _email_lower
        AND related_lead_table = _related_lead_table
        AND status = 'pending'
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.email_templates
    WHERE clinic_id = _clinic_id AND slug = _template_slug AND active = true
  ) THEN
    RAISE NOTICE 'enqueue_email: template % not found or inactive for clinic %', _template_slug, _clinic_id;
    RETURN NULL;
  END IF;

  INSERT INTO public.email_queue (
    clinic_id, template_slug, recipient_email, recipient_name, variables,
    scheduled_at, related_lead_id, related_lead_table, force_send, from_name_override
  ) VALUES (
    _clinic_id, _template_slug, _email_lower, _recipient_name, _variables,
    _scheduled_at, _related_lead_id, _related_lead_table, _force_send, NULLIF(trim(_from_name_override), '')
  ) RETURNING id INTO _id;
  RETURN _id;
END; $function$;

CREATE OR REPLACE FUNCTION public.merge_lead_custom_fields(
  p_lead_id uuid,
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_remove_keys text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE public.leads
  SET custom_fields = (COALESCE(custom_fields, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb)) - COALESCE(p_remove_keys, ARRAY[]::text[])
  WHERE id = p_lead_id
  RETURNING custom_fields INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'lead not found or access denied' USING ERRCODE = '42501';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_lead_custom_fields(uuid, jsonb, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_lead_custom_fields(uuid, jsonb, text[]) TO service_role;
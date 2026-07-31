DO $mig$
DECLARE
  v_def text;
  v_anchor text := '  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;';
  v_guard text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE proname = 'trg_lead_needs_extraction' AND pronamespace = 'public'::regnamespace;

  IF v_def IS NULL THEN RAISE EXCEPTION 'function not found'; END IF;

  IF position('mantenha esse c' in v_def) > 0 THEN
    RAISE NOTICE 'guard already present';
    RETURN;
  END IF;

  v_guard := v_anchor || E'\n' ||
    '  IF COALESCE(NEW.content, '''') ~* ''(mantenha esse c[óo]digo na sua mensagem|\(ref=[a-z0-9]{4,}\))'' THEN' || E'\n' ||
    '    RETURN NEW;' || E'\n' ||
    '  END IF;';

  IF position(v_anchor in v_def) = 0 THEN RAISE EXCEPTION 'anchor not found'; END IF;

  v_def := replace(v_def, v_anchor, v_guard);
  EXECUTE v_def;
END
$mig$;
CREATE OR REPLACE FUNCTION public.guard_clinic_features()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role / sem usuário autenticado (edge functions com SUPABASE_SERVICE_ROLE_KEY)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (COALESCE(OLD.settings -> 'features', 'null'::jsonb)
      IS DISTINCT FROM COALESCE(NEW.settings -> 'features', 'null'::jsonb))
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'only super admin can change clinic features';
  END IF;
  RETURN NEW;
END;
$function$;
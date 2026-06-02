REVOKE EXECUTE ON FUNCTION public.get_active_builder_manual() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_builder_manual() TO authenticated, service_role;
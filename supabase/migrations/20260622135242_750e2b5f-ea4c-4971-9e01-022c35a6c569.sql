REVOKE ALL ON FUNCTION public.cleanup_g10_expired() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_g10_expired() TO service_role;
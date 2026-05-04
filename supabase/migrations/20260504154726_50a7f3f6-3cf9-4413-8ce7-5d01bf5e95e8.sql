CREATE OR REPLACE FUNCTION public.cleanup_webhook_dedup()
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  DELETE FROM public.webhook_dedup WHERE expires_at < now();
$$;
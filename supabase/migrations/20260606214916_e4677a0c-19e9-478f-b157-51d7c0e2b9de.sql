-- Recriar tabela de lockout progressivo de login
CREATE TABLE IF NOT EXISTS public.auth_lockouts (
  email text PRIMARY KEY,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz NULL,
  last_failed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Apenas service_role acessa (edge function). Nenhum grant para anon/authenticated.
GRANT ALL ON public.auth_lockouts TO service_role;

ALTER TABLE public.auth_lockouts ENABLE ROW LEVEL SECURITY;
-- Sem policies: anon/authenticated não conseguem ler nem escrever via Data API.

-- ===== Funções auxiliares (SECURITY DEFINER) =====

-- Verifica estado atual; retorna se está bloqueado e por quanto tempo.
CREATE OR REPLACE FUNCTION public.check_login_lockout(_email text)
RETURNS TABLE(locked boolean, retry_after_seconds int, failed_attempts int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.auth_lockouts%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.auth_lockouts WHERE email = lower(_email);
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  IF r.locked_until IS NOT NULL AND r.locked_until > now() THEN
    RETURN QUERY SELECT true, GREATEST(1, EXTRACT(EPOCH FROM (r.locked_until - now()))::int), r.failed_attempts;
    RETURN;
  END IF;

  -- Se o último bloqueio era de 12h e já expirou, zera o contador.
  IF r.failed_attempts >= 13 AND r.locked_until IS NOT NULL AND r.locked_until <= now() THEN
    UPDATE public.auth_lockouts SET failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE email = lower(_email);
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 0, r.failed_attempts;
END;
$$;

-- Registra tentativa errada e aplica faixa progressiva.
-- Faixas: 5 -> 10min, 10 -> 1h, 13 -> 12h. Depois da 13ª, novas falhas mantêm 12h até zerar.
CREATE OR REPLACE FUNCTION public.register_failed_login(_email text)
RETURNS TABLE(locked boolean, retry_after_seconds int, failed_attempts int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_attempts int;
  new_lock timestamptz := NULL;
BEGIN
  INSERT INTO public.auth_lockouts (email, failed_attempts, last_failed_at, updated_at)
  VALUES (lower(_email), 1, now(), now())
  ON CONFLICT (email) DO UPDATE
    SET failed_attempts = public.auth_lockouts.failed_attempts + 1,
        last_failed_at = now(),
        updated_at = now()
  RETURNING public.auth_lockouts.failed_attempts INTO new_attempts;

  IF new_attempts >= 13 THEN
    new_lock := now() + interval '12 hours';
  ELSIF new_attempts >= 10 THEN
    new_lock := now() + interval '1 hour';
  ELSIF new_attempts >= 5 THEN
    new_lock := now() + interval '10 minutes';
  END IF;

  IF new_lock IS NOT NULL THEN
    UPDATE public.auth_lockouts SET locked_until = new_lock, updated_at = now() WHERE email = lower(_email);
    RETURN QUERY SELECT true, GREATEST(1, EXTRACT(EPOCH FROM (new_lock - now()))::int), new_attempts;
  ELSE
    RETURN QUERY SELECT false, 0, new_attempts;
  END IF;
END;
$$;

-- Zera no login bem-sucedido.
CREATE OR REPLACE FUNCTION public.clear_login_lockout(_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.auth_lockouts WHERE email = lower(_email);
$$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_auth_lockouts_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_auth_lockouts_updated_at ON public.auth_lockouts;
CREATE TRIGGER trg_auth_lockouts_updated_at
BEFORE UPDATE ON public.auth_lockouts
FOR EACH ROW EXECUTE FUNCTION public.tg_auth_lockouts_updated_at();
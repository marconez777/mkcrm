ALTER TABLE public.broadcasts DROP CONSTRAINT broadcasts_throttle_seconds_check;
ALTER TABLE public.broadcasts ADD CONSTRAINT broadcasts_throttle_seconds_check CHECK (throttle_seconds >= 5);
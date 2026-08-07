ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS region        text NOT NULL DEFAULT 'br',
  ADD COLUMN IF NOT EXISTS locale        text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS timezone      text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS currency      text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS phone_country text NOT NULL DEFAULT 'BR';

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_region_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_region_check CHECK (region IN ('br','es','us'));

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_currency_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_currency_check CHECK (currency IN ('BRL','EUR','USD'));

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_phone_country_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_phone_country_check CHECK (phone_country IN ('BR','ES','US'));

COMMENT ON COLUMN public.clinics.region        IS 'i18n region: br|es|us — drives RegionConfig (locale, tz, currency, providers).';
COMMENT ON COLUMN public.clinics.locale        IS 'BCP47 locale, e.g. pt-BR, es-ES, en-US.';
COMMENT ON COLUMN public.clinics.timezone      IS 'IANA timezone, e.g. America/Sao_Paulo.';
COMMENT ON COLUMN public.clinics.currency      IS 'ISO 4217: BRL|EUR|USD.';
COMMENT ON COLUMN public.clinics.phone_country IS 'ISO 3166-1 alpha-2 for libphonenumber-js: BR|ES|US.';
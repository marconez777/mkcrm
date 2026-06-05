CREATE TABLE public.eduzz_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL,
  fat_cod text,
  cnt_cod text,
  cli_email text,
  cli_name text,
  cli_taxnumber text,
  type text NOT NULL,
  fat_status int,
  valor numeric(10,2),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_status text NOT NULL DEFAULT 'ok',
  error_msg text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_eduzz_purchases_event
  ON public.eduzz_purchases (fat_cod, cnt_cod, type)
  WHERE fat_cod IS NOT NULL AND cnt_cod IS NOT NULL;

CREATE INDEX idx_eduzz_purchases_created ON public.eduzz_purchases (created_at DESC);
CREATE INDEX idx_eduzz_purchases_email ON public.eduzz_purchases (cli_email);
CREATE INDEX idx_eduzz_purchases_clinic ON public.eduzz_purchases (clinic_id);

GRANT SELECT ON public.eduzz_purchases TO authenticated;
GRANT ALL ON public.eduzz_purchases TO service_role;

ALTER TABLE public.eduzz_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eduzz_purchases_super_select"
  ON public.eduzz_purchases FOR SELECT TO authenticated
  USING (is_super_admin());

CREATE POLICY "eduzz_purchases_super_all"
  ON public.eduzz_purchases FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
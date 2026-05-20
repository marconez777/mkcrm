
-- form_integrations
CREATE TABLE public.form_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT ('mkf_' || encode(extensions.gen_random_bytes(16), 'hex')),
  previous_token text,
  previous_token_expires_at timestamptz,
  allowed_domains text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  default_pipeline_stage_id uuid,
  default_tags text[] NOT NULL DEFAULT '{}',
  total_submissions integer NOT NULL DEFAULT 0,
  last_submission_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, slug)
);
CREATE INDEX idx_form_integrations_clinic ON public.form_integrations(clinic_id);
CREATE INDEX idx_form_integrations_token ON public.form_integrations(token);

ALTER TABLE public.form_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_integrations_select ON public.form_integrations FOR SELECT
  TO authenticated USING (has_clinic_access(clinic_id));
CREATE POLICY form_integrations_admin_write ON public.form_integrations FOR ALL
  TO authenticated USING (has_clinic_access(clinic_id) AND is_clinic_admin())
  WITH CHECK (has_clinic_access(clinic_id) AND is_clinic_admin());

CREATE TRIGGER form_integrations_updated_at BEFORE UPDATE ON public.form_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- form_definitions
CREATE TABLE public.form_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.form_integrations(id) ON DELETE CASCADE,
  form_key text NOT NULL,
  name text NOT NULL,
  source_page text,
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_pipeline_stage_id uuid,
  default_tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  total_submissions integer NOT NULL DEFAULT 0,
  last_submission_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, form_key)
);
CREATE INDEX idx_form_definitions_clinic ON public.form_definitions(clinic_id);
CREATE INDEX idx_form_definitions_integration ON public.form_definitions(integration_id);

ALTER TABLE public.form_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_definitions_select ON public.form_definitions FOR SELECT
  TO authenticated USING (has_clinic_access(clinic_id));
CREATE POLICY form_definitions_admin_write ON public.form_definitions FOR ALL
  TO authenticated USING (has_clinic_access(clinic_id) AND is_clinic_admin())
  WITH CHECK (has_clinic_access(clinic_id) AND is_clinic_admin());

CREATE TRIGGER form_definitions_updated_at BEFORE UPDATE ON public.form_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- form_submissions
CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.form_integrations(id) ON DELETE CASCADE,
  form_definition_id uuid REFERENCES public.form_definitions(id) ON DELETE SET NULL,
  form_key text,
  source_page text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  lead_id uuid,
  is_new_lead boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_form_submissions_clinic ON public.form_submissions(clinic_id, created_at DESC);
CREATE INDEX idx_form_submissions_integration ON public.form_submissions(integration_id, created_at DESC);
CREATE INDEX idx_form_submissions_definition ON public.form_submissions(form_definition_id, created_at DESC);
CREATE INDEX idx_form_submissions_lead ON public.form_submissions(lead_id);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_submissions_select ON public.form_submissions FOR SELECT
  TO authenticated USING (has_clinic_access(clinic_id));
-- writes only via service role (edge function); no insert/update/delete policies for authenticated

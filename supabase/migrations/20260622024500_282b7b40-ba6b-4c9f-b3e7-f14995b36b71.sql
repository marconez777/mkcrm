
-- ============================================================
-- PR11.1 — Calendário: catálogo de tipos de serviço + colunas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.appointment_service_types (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  kind                  text NOT NULL CHECK (kind IN ('consulta','procedimento','retorno')),
  slug                  text NOT NULL,
  label                 text NOT NULL,
  color_hex             text NOT NULL DEFAULT '#3b82f6',
  default_duration_min  int  NOT NULL DEFAULT 60 CHECK (default_duration_min > 0 AND default_duration_min <= 600),
  active                boolean NOT NULL DEFAULT true,
  position              int  NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, kind, slug)
);

CREATE INDEX IF NOT EXISTS idx_ast_clinic_active
  ON public.appointment_service_types(clinic_id, active, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_service_types TO authenticated;
GRANT ALL                            ON public.appointment_service_types TO service_role;

ALTER TABLE public.appointment_service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY appointment_service_types_tenant_all
  ON public.appointment_service_types
  FOR ALL TO authenticated
  USING      ((clinic_id = current_clinic_id()) OR is_super_admin())
  WITH CHECK ((clinic_id = current_clinic_id()) OR is_super_admin());

CREATE TRIGGER trg_ast_set_updated_at
  BEFORE UPDATE ON public.appointment_service_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.appointment_service_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duration_min    int  NOT NULL DEFAULT 60 CHECK (duration_min > 0 AND duration_min <= 600);

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_range
  ON public.appointments(clinic_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_appointments_service_type
  ON public.appointments(service_type_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_service_types;


-- 1) Table
CREATE TABLE public.clinic_appointment_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  kind_name TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clinic_appointment_types_kind_name_format
    CHECK (kind_name ~ '^[a-z0-9_]{2,40}$'),
  CONSTRAINT clinic_appointment_types_clinic_kind_uk
    UNIQUE (clinic_id, kind_name)
);

CREATE INDEX idx_cat_clinic_active
  ON public.clinic_appointment_types (clinic_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_appointment_types TO authenticated;
GRANT ALL ON public.clinic_appointment_types TO service_role;

ALTER TABLE public.clinic_appointment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_read_clinic_members"
  ON public.clinic_appointment_types
  FOR SELECT
  TO authenticated
  USING ((clinic_id = current_clinic_id()) OR is_super_admin());

CREATE POLICY "cat_write_clinic_admin"
  ON public.clinic_appointment_types
  FOR ALL
  TO authenticated
  USING (
    is_super_admin() OR (
      clinic_id = current_clinic_id()
      AND EXISTS (
        SELECT 1 FROM public.clinic_members cm
        WHERE cm.clinic_id = clinic_appointment_types.clinic_id
          AND cm.user_id = auth.uid()
          AND cm.role IN ('owner','admin')
      )
    )
  )
  WITH CHECK (
    is_super_admin() OR (
      clinic_id = current_clinic_id()
      AND EXISTS (
        SELECT 1 FROM public.clinic_members cm
        WHERE cm.clinic_id = clinic_appointment_types.clinic_id
          AND cm.user_id = auth.uid()
          AND cm.role IN ('owner','admin')
      )
    )
  );

CREATE TRIGGER trg_cat_set_updated_at
  BEFORE UPDATE ON public.clinic_appointment_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Backfill existing clinics with defaults
INSERT INTO public.clinic_appointment_types (clinic_id, kind_name, label, is_active)
SELECT c.id, k.kind_name, k.label, true
FROM public.clinics c
CROSS JOIN (VALUES
  ('consulta','Consulta'),
  ('procedimento','Procedimento'),
  ('retorno','Retorno')
) AS k(kind_name, label)
ON CONFLICT (clinic_id, kind_name) DO NOTHING;

-- 3) Seed defaults for every new clinic
CREATE OR REPLACE FUNCTION public.tg_seed_clinic_appointment_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clinic_appointment_types (clinic_id, kind_name, label, is_active)
  VALUES
    (NEW.id, 'consulta',     'Consulta',     true),
    (NEW.id, 'procedimento', 'Procedimento', true),
    (NEW.id, 'retorno',      'Retorno',      true)
  ON CONFLICT (clinic_id, kind_name) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clinics_seed_appointment_types
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_clinic_appointment_types();

-- 4) Drop hardcoded CHECKs
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_kind_check;

ALTER TABLE public.appointment_service_types
  DROP CONSTRAINT IF EXISTS appointment_service_types_kind_check;

-- 5) Validation trigger: kind must exist as active clinic_appointment_type
CREATE OR REPLACE FUNCTION public.tg_appointments_validate_kind()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_appointment_types
    WHERE clinic_id = NEW.clinic_id
      AND kind_name = NEW.kind
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Tipo de agendamento "%" não está ativo para esta clínica', NEW.kind
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_appointments_validate_kind
  BEFORE INSERT OR UPDATE OF kind, clinic_id ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_appointments_validate_kind();

-- 6) Rewrite recompute function to iterate active kinds dynamically
CREATE OR REPLACE FUNCTION public.recompute_lead_appointment_summary(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_lhe       jsonb;
  v_patch     jsonb := '{}'::jsonb;
  v_kind      text;
  v_key       text;
  v_next      timestamptz;
  v_locked    boolean;
BEGIN
  SELECT clinic_id, COALESCE(custom_fields_last_human_edit, '{}'::jsonb)
    INTO v_clinic_id, v_lhe
    FROM public.leads WHERE id = _lead_id;
  IF v_clinic_id IS NULL THEN RETURN; END IF;

  FOR v_kind IN
    SELECT kind_name
      FROM public.clinic_appointment_types
     WHERE clinic_id = v_clinic_id AND is_active = true
  LOOP
    -- Compat: consulta/procedimento use the historic "_agendada_em" / "_agendado_em" keys
    v_key := CASE v_kind
      WHEN 'consulta' THEN 'consulta_agendada_em'
      ELSE v_kind || '_agendado_em'
    END;

    -- Human lock (7d) — do not overwrite recent manual edits
    v_locked := (v_lhe ? v_key)
      AND ((v_lhe->>v_key)::timestamptz > now() - interval '7 days');
    IF v_locked THEN CONTINUE; END IF;

    SELECT MIN(scheduled_at) INTO v_next
      FROM public.appointments
     WHERE lead_id = _lead_id
       AND kind = v_kind
       AND status = 'agendado'
       AND scheduled_at > now();

    v_patch := v_patch || jsonb_build_object(
      v_key,
      COALESCE(to_jsonb(v_next::text), 'null'::jsonb)
    );
  END LOOP;

  IF v_patch <> '{}'::jsonb THEN
    UPDATE public.leads
       SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) || v_patch,
           updated_at = now()
     WHERE id = _lead_id;
  END IF;
END;
$$;

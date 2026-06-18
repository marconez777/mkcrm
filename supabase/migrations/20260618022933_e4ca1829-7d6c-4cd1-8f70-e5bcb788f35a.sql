
-- ──────────────────────────────────────────────────────────────────────────
-- 1) Aliases canônicos
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stage_canonical_aliases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  pipeline_id     uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_id        uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  canonical_name  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, canonical_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_canonical_aliases TO authenticated;
GRANT ALL ON public.stage_canonical_aliases TO service_role;

ALTER TABLE public.stage_canonical_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_scoped" ON public.stage_canonical_aliases
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());

CREATE INDEX IF NOT EXISTS idx_stage_aliases_lookup
  ON public.stage_canonical_aliases (clinic_id, pipeline_id, canonical_name);

-- Seed por correspondência exata + sinônimos conhecidos.
WITH mapping AS (
  SELECT * FROM (VALUES
    ('Novo', 'Novo'),
    ('Qualificação', 'Qualificação'),
    ('Qualificacao', 'Qualificação'),
    ('Consulta agendada', 'Consulta agendada'),
    ('consulta agendada', 'Consulta agendada'),
    ('Reunião Agendada', 'Consulta agendada'),
    ('reuniao agendada', 'Consulta agendada'),
    ('Tratamento agendado', 'Tratamento agendado'),
    ('Procedimento agendado', 'Tratamento agendado'),
    ('Consulta finalizada', 'Consulta finalizada'),
    ('Em tratamento', 'Em tratamento'),
    ('Sem resposta', 'Sem resposta'),
    ('Lead - Sem resposta', 'Sem resposta'),
    ('Parou de Responder', 'Sem resposta'),
    ('Nutrição inativa', 'Nutrição inativa'),
    ('Nutricao inativa', 'Nutrição inativa'),
    ('Paciente antigo', 'Paciente antigo')
  ) AS t(name, canonical)
)
INSERT INTO public.stage_canonical_aliases (clinic_id, pipeline_id, stage_id, canonical_name)
SELECT DISTINCT ps.clinic_id, ps.pipeline_id, ps.id, m.canonical
FROM public.pipeline_stages ps
JOIN mapping m ON LOWER(ps.name) = LOWER(m.name)
ON CONFLICT (pipeline_id, canonical_name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- 2) pg_net + helper de notificação
-- ──────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_pipeline_deterministic(_action text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _url text := 'https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/pipeline-deterministic';
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ';
BEGIN
  PERFORM extensions.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon,
      'apikey', _anon
    ),
    body := jsonb_build_object('action', _action) || _payload
  );
EXCEPTION WHEN OTHERS THEN
  -- never break the originating transaction
  RAISE WARNING 'notify_pipeline_deterministic failed: %', SQLERRM;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 3) Triggers
-- ──────────────────────────────────────────────────────────────────────────

-- novo-lead
CREATE OR REPLACE FUNCTION public.tg_auto_novo_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_pipeline_deterministic('novo-lead', jsonb_build_object('lead_id', NEW.id));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leads_auto_novo_lead ON public.leads;
CREATE TRIGGER trg_leads_auto_novo_lead
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_novo_lead();

-- secretary-replied
CREATE OR REPLACE FUNCTION public.tg_auto_secretary_replied()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.from_me IS TRUE THEN
    PERFORM public.notify_pipeline_deterministic(
      'secretary-replied',
      jsonb_build_object('message_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_messages_auto_secretary ON public.messages;
CREATE TRIGGER trg_messages_auto_secretary
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_secretary_replied();

-- appointment-sync
CREATE OR REPLACE FUNCTION public.tg_auto_appointment_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_pipeline_deterministic(
      'appointment-sync',
      jsonb_build_object('appointment_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_appointments_auto_sync ON public.appointments;
CREATE TRIGGER trg_appointments_auto_sync
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_appointment_sync();

-- field-changed
CREATE OR REPLACE FUNCTION public.tg_auto_field_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.custom_fields IS DISTINCT FROM OLD.custom_fields THEN
    PERFORM public.notify_pipeline_deterministic(
      'field-changed',
      jsonb_build_object(
        'lead_id', NEW.id,
        'old_custom_fields', COALESCE(OLD.custom_fields, '{}'::jsonb),
        'new_custom_fields', COALESCE(NEW.custom_fields, '{}'::jsonb)
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leads_auto_field_changed ON public.leads;
CREATE TRIGGER trg_leads_auto_field_changed
  AFTER UPDATE OF custom_fields ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_field_changed();

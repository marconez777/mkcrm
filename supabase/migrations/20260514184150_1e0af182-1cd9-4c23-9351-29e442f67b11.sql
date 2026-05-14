
-- =========== message_sequences ===========
CREATE TABLE public.message_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT current_clinic_id(),
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL CHECK (trigger_type IN ('stage_enter','webhook','manual')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  whatsapp_instance_id uuid,
  stop_on_reply boolean NOT NULL DEFAULT true,
  cooldown_days integer NOT NULL DEFAULT 30,
  public_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinic_scoped ON public.message_sequences
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());

CREATE TRIGGER message_sequences_updated_at
  BEFORE UPDATE ON public.message_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== message_sequence_steps ===========
CREATE TABLE public.message_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT current_clinic_id(),
  sequence_id uuid NOT NULL REFERENCES public.message_sequences(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  delay_minutes integer NOT NULL DEFAULT 0,
  template_id uuid,
  content text,
  send_window jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX message_sequence_steps_seq_idx ON public.message_sequence_steps(sequence_id, position);

ALTER TABLE public.message_sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinic_scoped ON public.message_sequence_steps
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());

-- =========== message_sequence_enrollments ===========
CREATE TABLE public.message_sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT current_clinic_id(),
  sequence_id uuid NOT NULL REFERENCES public.message_sequences(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','canceled','stopped_by_reply','failed')),
  current_step integer NOT NULL DEFAULT 0,
  next_run_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  source jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX msenroll_active_idx ON public.message_sequence_enrollments(status, next_run_at) WHERE status = 'active';
CREATE INDEX msenroll_lead_idx ON public.message_sequence_enrollments(lead_id);
CREATE INDEX msenroll_seq_lead_idx ON public.message_sequence_enrollments(sequence_id, lead_id);

ALTER TABLE public.message_sequence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinic_scoped ON public.message_sequence_enrollments
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());

-- =========== message_sequence_runs ===========
CREATE TABLE public.message_sequence_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT current_clinic_id(),
  enrollment_id uuid NOT NULL REFERENCES public.message_sequence_enrollments(id) ON DELETE CASCADE,
  step_id uuid,
  status text NOT NULL CHECK (status IN ('sent','failed','skipped')),
  message_id uuid,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX msrun_enroll_idx ON public.message_sequence_runs(enrollment_id, created_at DESC);

ALTER TABLE public.message_sequence_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinic_scoped ON public.message_sequence_runs
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());

-- =========== Trigger: stage_enter ===========
-- Quando lead muda de stage, inscreve em todas as sequências stage_enter daquela stage.
CREATE OR REPLACE FUNCTION public.enroll_lead_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq RECORD;
  cooldown_cutoff timestamptz;
BEGIN
  IF NEW.stage_id IS NULL OR NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  FOR seq IN
    SELECT id, cooldown_days
    FROM public.message_sequences
    WHERE clinic_id = NEW.clinic_id
      AND enabled = true
      AND trigger_type = 'stage_enter'
      AND (trigger_config->>'stage_id')::uuid = NEW.stage_id
  LOOP
    cooldown_cutoff := now() - make_interval(days => seq.cooldown_days);
    -- Pula se o lead já tem inscrição recente nessa sequência
    IF EXISTS (
      SELECT 1 FROM public.message_sequence_enrollments
      WHERE sequence_id = seq.id AND lead_id = NEW.id
        AND started_at > cooldown_cutoff
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.message_sequence_enrollments
      (clinic_id, sequence_id, lead_id, status, current_step, next_run_at, source)
    VALUES
      (NEW.clinic_id, seq.id, NEW.id, 'active', 0, now(),
       jsonb_build_object('trigger','stage_enter','stage_id',NEW.stage_id));
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enroll_on_stage_change
  AFTER UPDATE OF stage_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enroll_lead_on_stage_change();

-- =========== Trigger: stop_on_reply ===========
-- Quando lead envia mensagem inbound, pausa enrollments active com stop_on_reply.
CREATE OR REPLACE FUNCTION public.stop_sequences_on_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.from_me = true THEN
    RETURN NEW;
  END IF;

  UPDATE public.message_sequence_enrollments e
  SET status = 'stopped_by_reply', ended_at = now()
  FROM public.message_sequences s
  WHERE e.sequence_id = s.id
    AND e.lead_id = NEW.lead_id
    AND e.status = 'active'
    AND s.stop_on_reply = true;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stop_sequences_on_reply
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.stop_sequences_on_reply();

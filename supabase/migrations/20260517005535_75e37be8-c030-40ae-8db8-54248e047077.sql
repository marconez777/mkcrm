
-- Broadcasts (disparo em massa)
CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft|running|paused|done|failed|cancelled
  whatsapp_instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  throttle_seconds int NOT NULL DEFAULT 1200 CHECK (throttle_seconds >= 900),
  send_window jsonb NOT NULL DEFAULT '{"start":"08:00","end":"18:00","tz":"America/Sao_Paulo","weekdays":[1,2,3,4,5]}'::jsonb,
  source jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{"queued":0,"sent":0,"failed":0,"replied":0}'::jsonb,
  scheduled_at timestamptz,
  audience_frozen_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.broadcasts (clinic_id, status);
CREATE INDEX ON public.broadcasts (status) WHERE status = 'running';

CREATE TABLE public.broadcast_message_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  position int NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, position)
);

CREATE TABLE public.broadcast_message_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.broadcast_message_groups(id) ON DELETE CASCADE,
  position int NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, position)
);

CREATE TABLE public.broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  phone text NOT NULL,
  name text,
  custom jsonb NOT NULL DEFAULT '{}'::jsonb,
  group_position int,
  status text NOT NULL DEFAULT 'pending', -- pending|sending|sent|failed|skipped|replied
  parts_sent int NOT NULL DEFAULT 0,
  next_send_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  sent_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, phone)
);
CREATE INDEX ON public.broadcast_recipients (broadcast_id, status, next_send_at);
CREATE INDEX ON public.broadcast_recipients (clinic_id, phone);

CREATE TABLE public.broadcast_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.broadcast_recipients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.broadcast_events (broadcast_id, created_at DESC);

-- Trigger updated_at
CREATE TRIGGER trg_broadcasts_updated_at BEFORE UPDATE ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_message_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_message_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcasts_clinic_access" ON public.broadcasts
  FOR ALL USING (public.has_clinic_access(clinic_id)) WITH CHECK (public.has_clinic_access(clinic_id));

CREATE POLICY "bgroups_clinic_access" ON public.broadcast_message_groups
  FOR ALL USING (EXISTS (SELECT 1 FROM public.broadcasts b WHERE b.id = broadcast_id AND public.has_clinic_access(b.clinic_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.broadcasts b WHERE b.id = broadcast_id AND public.has_clinic_access(b.clinic_id)));

CREATE POLICY "bparts_clinic_access" ON public.broadcast_message_parts
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.broadcast_message_groups g
    JOIN public.broadcasts b ON b.id = g.broadcast_id
    WHERE g.id = group_id AND public.has_clinic_access(b.clinic_id)
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.broadcast_message_groups g
    JOIN public.broadcasts b ON b.id = g.broadcast_id
    WHERE g.id = group_id AND public.has_clinic_access(b.clinic_id)
  ));

CREATE POLICY "brecipients_clinic_access" ON public.broadcast_recipients
  FOR ALL USING (public.has_clinic_access(clinic_id)) WITH CHECK (public.has_clinic_access(clinic_id));

CREATE POLICY "bevents_clinic_access" ON public.broadcast_events
  FOR ALL USING (public.has_clinic_access(clinic_id)) WITH CHECK (public.has_clinic_access(clinic_id));

-- Freeze audience: pega leads do pipeline (etapas), mais contatos importados extras (passados como JSON),
-- e atribui group_position via round-robin.
CREATE OR REPLACE FUNCTION public.broadcast_freeze_audience(
  _broadcast_id uuid,
  _pipeline_id uuid,
  _stage_ids uuid[],
  _extra_contacts jsonb DEFAULT '[]'::jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _clinic uuid;
  _groups int;
  _inserted int := 0;
BEGIN
  SELECT clinic_id INTO _clinic FROM public.broadcasts WHERE id = _broadcast_id;
  IF _clinic IS NULL THEN RAISE EXCEPTION 'broadcast_not_found'; END IF;
  IF NOT public.has_clinic_access(_clinic) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COUNT(*) INTO _groups FROM public.broadcast_message_groups WHERE broadcast_id = _broadcast_id;
  IF _groups = 0 THEN RAISE EXCEPTION 'no_message_groups'; END IF;

  -- limpa pendentes ainda não enviados (re-freeze)
  DELETE FROM public.broadcast_recipients
   WHERE broadcast_id = _broadcast_id AND status = 'pending';

  WITH lead_src AS (
    SELECT l.id AS lead_id, l.phone, l.name, COALESCE(l.custom_fields, '{}'::jsonb) AS custom
    FROM public.leads l
    WHERE l.clinic_id = _clinic
      AND _pipeline_id IS NOT NULL
      AND (_stage_ids IS NULL OR array_length(_stage_ids, 1) IS NULL OR l.stage_id = ANY(_stage_ids))
      AND (_pipeline_id IS NULL OR l.pipeline_id = _pipeline_id)
      AND l.phone IS NOT NULL AND length(l.phone) >= 8
  ),
  extra_src AS (
    SELECT NULL::uuid AS lead_id,
           (e->>'phone')::text AS phone,
           NULLIF(e->>'name','') AS name,
           COALESCE(e->'custom', '{}'::jsonb) AS custom
    FROM jsonb_array_elements(_extra_contacts) e
    WHERE (e->>'phone') IS NOT NULL AND length(e->>'phone') >= 8
  ),
  combined AS (
    SELECT * FROM lead_src
    UNION
    SELECT * FROM extra_src
  ),
  ordered AS (
    SELECT *, row_number() OVER (ORDER BY random()) AS rn
    FROM combined
  ),
  ins AS (
    INSERT INTO public.broadcast_recipients
      (broadcast_id, clinic_id, lead_id, phone, name, custom, group_position, status, next_send_at)
    SELECT _broadcast_id, _clinic, lead_id, phone, name, custom,
           ((rn - 1) % _groups) + 1, 'pending', now()
    FROM ordered
    ON CONFLICT (broadcast_id, phone) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;

  UPDATE public.broadcasts
     SET audience_frozen_at = now(),
         totals = jsonb_set(totals, '{queued}', to_jsonb((
           SELECT count(*) FROM public.broadcast_recipients WHERE broadcast_id = _broadcast_id
         )))
   WHERE id = _broadcast_id;

  RETURN _inserted;
END $$;

-- Mark reply (chamado pelo webhook)
CREATE OR REPLACE FUNCTION public.broadcast_mark_replied(_clinic_id uuid, _phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.broadcast_recipients
     SET status = 'replied', replied_at = now()
   WHERE clinic_id = _clinic_id
     AND phone = _phone
     AND status = 'sent'
     AND replied_at IS NULL;

  INSERT INTO public.broadcast_events (broadcast_id, recipient_id, clinic_id, type, payload)
  SELECT r.broadcast_id, r.id, r.clinic_id, 'replied', jsonb_build_object('phone', _phone)
  FROM public.broadcast_recipients r
  WHERE r.clinic_id = _clinic_id AND r.phone = _phone AND r.replied_at = (
    SELECT max(replied_at) FROM public.broadcast_recipients WHERE clinic_id = _clinic_id AND phone = _phone
  );
END $$;

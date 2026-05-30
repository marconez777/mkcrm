
ALTER TABLE public.message_sequence_runs
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS stage_id_at_send uuid,
  ADD COLUMN IF NOT EXISTS stage_position_at_send int;

ALTER TABLE public.broadcast_recipients
  ADD COLUMN IF NOT EXISTS stage_id_at_send uuid,
  ADD COLUMN IF NOT EXISTS stage_position_at_send int;

CREATE INDEX IF NOT EXISTS msrun_step_status_idx ON public.message_sequence_runs(step_id, status);
CREATE INDEX IF NOT EXISTS brecip_broadcast_status_idx ON public.broadcast_recipients(broadcast_id, status);

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

  UPDATE public.message_sequence_runs r
  SET replied_at = COALESCE(r.replied_at, now())
  FROM public.message_sequence_enrollments e
  WHERE r.enrollment_id = e.id
    AND e.lead_id = NEW.lead_id
    AND e.status = 'active'
    AND r.status = 'sent'
    AND r.replied_at IS NULL
    AND r.id = (
      SELECT r2.id FROM public.message_sequence_runs r2
      WHERE r2.enrollment_id = e.id AND r2.status = 'sent'
      ORDER BY r2.created_at DESC LIMIT 1
    );

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

CREATE OR REPLACE FUNCTION public.engagement_broadcasts_summary(_from timestamptz, _to timestamptz)
RETURNS TABLE (
  broadcast_id uuid,
  broadcast_name text,
  created_at timestamptz,
  sent_count int,
  replied_count int,
  qualified_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.name,
    b.created_at,
    COUNT(r.id) FILTER (WHERE r.status IN ('sent','replied'))::int,
    COUNT(r.id) FILTER (WHERE r.replied_at IS NOT NULL)::int,
    COUNT(r.id) FILTER (
      WHERE r.lead_id IS NOT NULL
        AND r.stage_position_at_send IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.leads l
          JOIN public.pipeline_stages s ON s.id = l.stage_id
          WHERE l.id = r.lead_id
            AND s.position > r.stage_position_at_send
        )
    )::int
  FROM public.broadcasts b
  LEFT JOIN public.broadcast_recipients r ON r.broadcast_id = b.id
  WHERE b.clinic_id = current_clinic_id()
    AND b.created_at >= _from AND b.created_at < _to
  GROUP BY b.id, b.name, b.created_at
  ORDER BY b.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.engagement_sequences_summary(_from timestamptz, _to timestamptz)
RETURNS TABLE (
  sequence_id uuid,
  sequence_name text,
  enabled boolean,
  sent_count int,
  replied_count int,
  qualified_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    seq.id,
    seq.name,
    seq.enabled,
    COUNT(run.id) FILTER (WHERE run.status = 'sent')::int,
    COUNT(run.id) FILTER (WHERE run.replied_at IS NOT NULL)::int,
    COUNT(DISTINCT en.lead_id) FILTER (
      WHERE run.stage_position_at_send IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.leads l
          JOIN public.pipeline_stages s ON s.id = l.stage_id
          WHERE l.id = en.lead_id
            AND s.position > run.stage_position_at_send
        )
    )::int
  FROM public.message_sequences seq
  LEFT JOIN public.message_sequence_enrollments en ON en.sequence_id = seq.id
  LEFT JOIN public.message_sequence_runs run ON run.enrollment_id = en.id
    AND run.created_at >= _from AND run.created_at < _to
  WHERE seq.clinic_id = current_clinic_id()
  GROUP BY seq.id, seq.name, seq.enabled
  ORDER BY seq.name;
$$;

CREATE OR REPLACE FUNCTION public.engagement_sequence_steps(_sequence_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE (
  step_id uuid,
  step_position int,
  sent_count int,
  replied_count int,
  qualified_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    st.id,
    st.position,
    COUNT(run.id) FILTER (WHERE run.status = 'sent')::int,
    COUNT(run.id) FILTER (WHERE run.replied_at IS NOT NULL)::int,
    COUNT(DISTINCT en.lead_id) FILTER (
      WHERE run.stage_position_at_send IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.leads l
          JOIN public.pipeline_stages s ON s.id = l.stage_id
          WHERE l.id = en.lead_id
            AND s.position > run.stage_position_at_send
        )
    )::int
  FROM public.message_sequence_steps st
  LEFT JOIN public.message_sequence_runs run ON run.step_id = st.id
    AND run.created_at >= _from AND run.created_at < _to
  LEFT JOIN public.message_sequence_enrollments en ON en.id = run.enrollment_id
  WHERE st.sequence_id = _sequence_id
    AND EXISTS (SELECT 1 FROM public.message_sequences s WHERE s.id = _sequence_id AND s.clinic_id = current_clinic_id())
  GROUP BY st.id, st.position
  ORDER BY st.position;
$$;

GRANT EXECUTE ON FUNCTION public.engagement_broadcasts_summary(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.engagement_sequences_summary(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.engagement_sequence_steps(uuid, timestamptz, timestamptz) TO authenticated;

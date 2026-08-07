CREATE OR REPLACE FUNCTION public.recompute_lead_appointment_summary(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_consulta     timestamptz;
  v_next_procedimento timestamptz;
  v_clinic_id         uuid;
  v_lhe               jsonb;
  v_consulta_locked   boolean := false;
  v_proc_locked       boolean := false;
  v_patch             jsonb := '{}'::jsonb;
BEGIN
  SELECT clinic_id, COALESCE(custom_fields_last_human_edit, '{}'::jsonb)
    INTO v_clinic_id, v_lhe
    FROM public.leads WHERE id = _lead_id;
  IF v_clinic_id IS NULL THEN RETURN; END IF;

  -- G10: se humano tocou recentemente (7d), não sobrescreve.
  IF (v_lhe ? 'consulta_agendada_em')
     AND ((v_lhe->>'consulta_agendada_em')::timestamptz > now() - interval '7 days') THEN
    v_consulta_locked := true;
  END IF;
  IF (v_lhe ? 'procedimento_agendado_em')
     AND ((v_lhe->>'procedimento_agendado_em')::timestamptz > now() - interval '7 days') THEN
    v_proc_locked := true;
  END IF;

  IF NOT v_consulta_locked THEN
    SELECT MIN(scheduled_at) INTO v_next_consulta
      FROM public.appointments
     WHERE lead_id = _lead_id AND kind = 'consulta'
       AND status = 'agendado' AND scheduled_at > now();
    v_patch := v_patch || jsonb_build_object(
      'consulta_agendada_em',
      COALESCE(to_jsonb(v_next_consulta::text), 'null'::jsonb)
    );
  END IF;

  IF NOT v_proc_locked THEN
    SELECT MIN(scheduled_at) INTO v_next_procedimento
      FROM public.appointments
     WHERE lead_id = _lead_id AND kind = 'procedimento'
       AND status = 'agendado' AND scheduled_at > now();
    v_patch := v_patch || jsonb_build_object(
      'procedimento_agendado_em',
      COALESCE(to_jsonb(v_next_procedimento::text), 'null'::jsonb)
    );
  END IF;

  IF v_patch <> '{}'::jsonb THEN
    UPDATE public.leads
       SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) || v_patch,
           updated_at = now()
     WHERE id = _lead_id;
  END IF;
END;
$$;
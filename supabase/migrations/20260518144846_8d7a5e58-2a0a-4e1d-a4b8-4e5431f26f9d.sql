CREATE OR REPLACE FUNCTION public.assert_clinic_id_not_null()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  derived uuid;
  rec jsonb;
BEGIN
  IF NEW.clinic_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  rec := to_jsonb(NEW);

  IF rec ? 'agent_id' AND (rec->>'agent_id') IS NOT NULL THEN
    SELECT clinic_id INTO derived FROM public.ai_agents WHERE id = (rec->>'agent_id')::uuid;
    IF derived IS NOT NULL THEN NEW.clinic_id := derived; RETURN NEW; END IF;
  END IF;

  IF rec ? 'lead_id' AND (rec->>'lead_id') IS NOT NULL THEN
    SELECT clinic_id INTO derived FROM public.leads WHERE id = (rec->>'lead_id')::uuid;
    IF derived IS NOT NULL THEN NEW.clinic_id := derived; RETURN NEW; END IF;
  END IF;

  IF rec ? 'thread_id' AND (rec->>'thread_id') IS NOT NULL THEN
    SELECT clinic_id INTO derived FROM public.ai_threads WHERE id = (rec->>'thread_id')::uuid;
    IF derived IS NOT NULL THEN NEW.clinic_id := derived; RETURN NEW; END IF;
  END IF;

  RAISE EXCEPTION 'clinic_id_required: tabela % exige clinic_id e nao foi possivel derivar de agent_id/lead_id/thread_id', TG_TABLE_NAME
    USING ERRCODE = '23502';
END $$;

CREATE OR REPLACE FUNCTION public.log_agent_trace(
  p_run_id uuid, p_agent_id uuid, p_thread_id uuid, p_lead_id uuid,
  p_step int, p_kind text, p_name text,
  p_latency_ms int, p_tokens_in int, p_tokens_out int,
  p_error text, p_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
BEGIN
  SELECT clinic_id INTO v_clinic FROM public.ai_agents WHERE id = p_agent_id;
  IF v_clinic IS NULL AND p_lead_id IS NOT NULL THEN
    SELECT clinic_id INTO v_clinic FROM public.leads WHERE id = p_lead_id;
  END IF;
  IF v_clinic IS NULL AND p_thread_id IS NOT NULL THEN
    SELECT clinic_id INTO v_clinic FROM public.ai_threads WHERE id = p_thread_id;
  END IF;
  INSERT INTO public.agent_traces(clinic_id, run_id, agent_id, thread_id, lead_id, step, kind, name, latency_ms, tokens_in, tokens_out, error, payload)
  VALUES (v_clinic, p_run_id, p_agent_id, p_thread_id, p_lead_id, p_step, p_kind, p_name, p_latency_ms, p_tokens_in, p_tokens_out, p_error, p_payload);
END $$;
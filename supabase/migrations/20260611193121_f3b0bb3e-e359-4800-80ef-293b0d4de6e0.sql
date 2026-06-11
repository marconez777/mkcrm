
-- =========================================================
-- F1: Trigger SQL "trg_lead_needs_extraction"
--   - Roda em mensagens inbound (from_me=false, is_automated=false)
--   - Detecta procedimentos PT-BR, interesse, pagamento, agendamento
--   - Desqualifica em mensções de EMDR (procedimento não atendido)
--   - Preenche leads.custom_fields apenas quando vazio e sem manual_lock
--   - Marca needs_ai_review pra IA seguir adiante (F2+)
-- =========================================================

CREATE OR REPLACE FUNCTION public.trg_lead_needs_extraction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead         RECORD;
  v_text         text;
  v_reasons      text[] := '{}';
  v_now          timestamptz := now();
  v_custom       jsonb;
  v_proc         text;
  v_emdr_match   text;
  v_locked       boolean;
  v_emdr_re      text := '(emdr|dessensibiliza[çc][ãa]o e reprocessamento|reprocessamento dos movimentos? oculares?)';
BEGIN
  -- Somente mensagens inbound de humanos
  IF COALESCE(NEW.from_me, false) IS TRUE THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_automated, false) IS TRUE THEN RETURN NEW; END IF;
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, clinic_id, custom_fields, ai_review_reasons,
         needs_ai_review, ai_review_queued_at, manual_lock_until
    INTO v_lead
    FROM public.leads
   WHERE id = NEW.lead_id;
  IF v_lead.id IS NULL THEN RETURN NEW; END IF;

  v_text   := lower(COALESCE(NEW.content, ''));
  v_custom := COALESCE(v_lead.custom_fields, '{}'::jsonb);
  v_locked := v_lead.manual_lock_until IS NOT NULL AND v_lead.manual_lock_until > v_now;

  -- ========== Mídia: marcar pra ticks futuros ==========
  IF NEW.media_url IS NOT NULL THEN
    IF NEW.message_type IN ('image','document') THEN
      v_reasons := array_append(v_reasons, 'media:image');
    ELSIF NEW.message_type IN ('audio','ptt','voice') THEN
      NEW.needs_audio_transcription := true;
      v_reasons := array_append(v_reasons, 'media:audio');
    END IF;
  END IF;

  IF length(v_text) > 0 THEN
    -- ========== PROCEDIMENTO NÃO ATENDIDO (EMDR & cia) ==========
    IF v_text ~* v_emdr_re THEN
      v_emdr_match := (regexp_matches(v_text, v_emdr_re, 'i'))[1];
      v_reasons := array_append(v_reasons, 'proc_nao_atendido:' || v_emdr_match);
      IF NOT v_locked AND COALESCE(v_custom->>'qualificacao','') <> 'desqualificado' THEN
        v_custom := v_custom || jsonb_build_object(
          'qualificacao', 'desqualificado',
          'desqualificacao_motivo', 'procedimento não oferecido: ' || v_emdr_match,
          'desqualificacao_em', to_jsonb(v_now)
        );
      END IF;
    END IF;

    -- ========== PROCEDIMENTO DETECTADO ==========
    v_proc := NULL;
    IF    v_text ~* '\m(cetamina|ketamina|infus[ãa]o)\M' THEN
      v_proc := 'cetamina';
    ELSIF v_text ~* '\memt\M' OR v_text ~* 'estimula[çc][aã]o magn[ée]tica transcraniana' THEN
      v_proc := 'emt';
    ELSIF v_text ~* '(primeira consulta|avalia[çc][ãa]o inicial)' THEN
      v_proc := 'primeira_consulta';
    ELSIF v_text ~* '\m(retorno|reavalia[çc][ãa]o)\M' THEN
      v_proc := 'retorno';
    ELSIF v_text ~* '\m(seguimento|acompanhamento)\M' THEN
      v_proc := 'seguimento';
    ELSIF v_text ~* '\m(psicoterapia|terapia|sess[ãa]o de terapia)\M' THEN
      v_proc := 'terapia';
    END IF;

    IF v_proc IS NOT NULL THEN
      v_reasons := array_append(v_reasons, 'procedimento:' || v_proc);
      IF NOT v_locked AND (v_custom->>'procedimento_interesse') IS NULL THEN
        v_custom := jsonb_set(v_custom, '{procedimento_interesse}', to_jsonb(v_proc), true);
      END IF;
    END IF;

    -- ========== INTERESSE ==========
    IF v_text ~* '\m(quero|gostaria|preciso|me interesso)\M'
       OR v_text ~* '(tenho interesse|posso fazer|tem como|como funciona|quanto custa|qual o valor|valor da)' THEN
      v_reasons := array_append(v_reasons, 'interesse');
      IF NOT v_locked AND (v_custom->>'demonstrou_interesse') IS NULL THEN
        v_custom := jsonb_set(v_custom, '{demonstrou_interesse}', 'true'::jsonb, true);
      END IF;
    END IF;

    -- ========== PAGAMENTO ==========
    IF v_text ~* '\m(pix|comprovante|pagamento|transferi|pagar|boleto|cart[ãa]o)\M' THEN
      v_reasons := array_append(v_reasons, 'pagamento');
      IF NOT v_locked AND (v_custom->>'tentou_pagamento') IS NULL THEN
        v_custom := jsonb_set(v_custom, '{tentou_pagamento}', 'true'::jsonb, true);
      END IF;
    END IF;

    -- ========== AGENDAMENTO ==========
    IF v_text ~* '\m(agendar|marcar|hor[aá]rio|dispon[ií]vel|amanh[ãa]|hoje|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)\M'
       OR v_text ~* '(semana que vem|pr[oó]xima semana|esse hor[aá]rio|que horas)'
       OR v_text ~ '\m\d{1,2}[\/\-]\d{1,2}\M'
       OR v_text ~ '\m\d{1,2}h\d{0,2}\M' THEN
      v_reasons := array_append(v_reasons, 'agendamento');
      IF NOT v_locked AND (v_custom->>'tentou_agendar') IS NULL THEN
        v_custom := jsonb_set(v_custom, '{tentou_agendar}', 'true'::jsonb, true);
      END IF;
    END IF;
  END IF;

  -- Nada relevante detectado
  IF array_length(v_reasons, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Aplica alterações no lead (custom_fields + flags de revisão)
  UPDATE public.leads
     SET custom_fields = v_custom,
         needs_ai_review = true,
         ai_review_queued_at = COALESCE(ai_review_queued_at, v_now),
         ai_review_reasons = (
           SELECT COALESCE(array_agg(DISTINCT r), '{}'::text[])
             FROM unnest(COALESCE(ai_review_reasons, '{}'::text[]) || v_reasons) r
         )
   WHERE id = v_lead.id;

  -- Auditoria no timeline do lead
  INSERT INTO public.lead_events(clinic_id, lead_id, type, payload, created_at)
  VALUES (
    v_lead.clinic_id,
    v_lead.id,
    'ai_review_queued',
    jsonb_build_object(
      'reasons', v_reasons,
      'message_id', NEW.id,
      'rule_engine', 'sql_v1'
    ),
    v_now
  );

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT pra poder ajustar NEW (needs_audio_transcription)
DROP TRIGGER IF EXISTS messages_lead_needs_extraction ON public.messages;
CREATE TRIGGER messages_lead_needs_extraction
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_lead_needs_extraction();

-- Index pra recuperar a fila pelos ticks
CREATE INDEX IF NOT EXISTS idx_messages_audio_pending
  ON public.messages (clinic_id, created_at)
  WHERE needs_audio_transcription = true AND transcript IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_vision_pending
  ON public.messages (clinic_id, created_at)
  WHERE vision_processed = false AND media_url IS NOT NULL AND message_type IN ('image','document');

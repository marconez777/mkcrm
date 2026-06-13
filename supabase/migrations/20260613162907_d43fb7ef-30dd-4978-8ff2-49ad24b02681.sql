-- 1) Trava de movimentação automática em etapas do Kanban
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS lock_auto_move boolean NOT NULL DEFAULT false;

-- Marca toda etapa "Administrativo" (case-insensitive) como travada
UPDATE public.pipeline_stages
   SET lock_auto_move = true
 WHERE lower(name) = 'administrativo';

-- 2) Trigger mais conservador para "tentou_agendar"
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
  v_has_agenda_hint boolean;
  v_has_confirmation boolean;
BEGIN
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

  IF NEW.media_url IS NOT NULL THEN
    IF NEW.message_type IN ('image','document') THEN
      v_reasons := array_append(v_reasons, 'media:image');
    ELSIF NEW.message_type IN ('audio','ptt','voice') THEN
      NEW.needs_audio_transcription := true;
      v_reasons := array_append(v_reasons, 'media:audio');
    END IF;
  END IF;

  IF length(v_text) > 0 THEN
    -- EMDR / procedimentos não atendidos
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

    -- PROCEDIMENTO
    v_proc := NULL;
    IF    v_text ~* '\m(cetamina|ketamina|infus[ãa]o)\M' THEN v_proc := 'cetamina';
    ELSIF v_text ~* '\memt\M' OR v_text ~* 'estimula[çc][aã]o magn[ée]tica transcraniana' THEN v_proc := 'emt';
    ELSIF v_text ~* '(primeira consulta|avalia[çc][ãa]o inicial)' THEN v_proc := 'primeira_consulta';
    ELSIF v_text ~* '\m(retorno|reavalia[çc][ãa]o)\M' THEN v_proc := 'retorno';
    ELSIF v_text ~* '\m(seguimento|acompanhamento)\M' THEN v_proc := 'seguimento';
    ELSIF v_text ~* '\m(psicoterapia|terapia|sess[ãa]o de terapia)\M' THEN v_proc := 'terapia';
    END IF;

    IF v_proc IS NOT NULL THEN
      v_reasons := array_append(v_reasons, 'procedimento:' || v_proc);
      IF NOT v_locked AND (v_custom->>'procedimento_interesse') IS NULL THEN
        v_custom := jsonb_set(v_custom, '{procedimento_interesse}', to_jsonb(v_proc), true);
      END IF;
    END IF;

    -- INTERESSE
    IF v_text ~* '\m(quero|gostaria|preciso|me interesso)\M'
       OR v_text ~* '(tenho interesse|posso fazer|tem como|como funciona|quanto custa|qual o valor|valor da)' THEN
      v_reasons := array_append(v_reasons, 'interesse');
      IF NOT v_locked AND (v_custom->>'demonstrou_interesse') IS NULL THEN
        v_custom := jsonb_set(v_custom, '{demonstrou_interesse}', 'true'::jsonb, true);
      END IF;
    END IF;

    -- PAGAMENTO
    IF v_text ~* '\m(pix|comprovante|pagamento|transferi|pagar|boleto|cart[ãa]o)\M' THEN
      v_reasons := array_append(v_reasons, 'pagamento');
      IF NOT v_locked AND (v_custom->>'tentou_pagamento') IS NULL THEN
        v_custom := jsonb_set(v_custom, '{tentou_pagamento}', 'true'::jsonb, true);
      END IF;
    END IF;

    -- AGENDAMENTO (mais conservador)
    -- Sinaliza para IA revisar com qualquer pista, mas só seta tentou_agendar com confirmação explícita
    v_has_agenda_hint :=
      v_text ~* '\m(agendar|marcar|hor[aá]rio|dispon[ií]vel|amanh[ãa]|hoje|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)\M'
      OR v_text ~* '(semana que vem|pr[oó]xima semana|esse hor[aá]rio|que horas)'
      OR v_text ~ '\m\d{1,2}[\/\-]\d{1,2}\M'
      OR v_text ~ '\m\d{1,2}h\d{0,2}\M';

    -- Confirmação explícita: verbo de confirmação OU data+hora juntas
    v_has_confirmation :=
      v_text ~* '(pode (ser|marcar|agendar)|confirmo|confirmado|fechado|fechamos|fica (marcado|agendado)|combinado|combinamos)'
      OR (v_text ~ '\m\d{1,2}[\/\-]\d{1,2}\M' AND v_text ~ '\m\d{1,2}h\d{0,2}\M');

    IF v_has_agenda_hint THEN
      v_reasons := array_append(v_reasons, 'agendamento');
      IF v_has_confirmation
         AND NOT v_locked
         AND (v_custom->>'tentou_agendar') IS NULL THEN
        v_custom := jsonb_set(v_custom, '{tentou_agendar}', 'true'::jsonb, true);
      END IF;
    END IF;
  END IF;

  IF array_length(v_reasons, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.leads
     SET custom_fields = v_custom,
         needs_ai_review = true,
         ai_review_queued_at = COALESCE(ai_review_queued_at, v_now),
         ai_review_reasons = (
           SELECT COALESCE(array_agg(DISTINCT r), '{}'::text[])
             FROM unnest(COALESCE(ai_review_reasons, '{}'::text[]) || v_reasons) r
         )
   WHERE id = v_lead.id;

  INSERT INTO public.lead_events(clinic_id, lead_id, type, payload, created_at)
  VALUES (
    v_lead.clinic_id,
    v_lead.id,
    'ai_review_queued',
    jsonb_build_object(
      'reasons', v_reasons,
      'message_id', NEW.id,
      'rule_engine', 'sql_v2'
    ),
    v_now
  );

  RETURN NEW;
END;
$$;

-- Onda 0 — Foundation: colunas estruturais para destravar Ondas 1–5 do AUDIT_EXTRACTOR_PIPELINE.
-- Nenhuma mudança de comportamento; só estrutura + validação de enums em custom_fields.

-- 1. messages.is_auto_reply: marca respostas automáticas fora-de-horário (B31, I1)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_auto_reply boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_messages_lead_real_outbound
  ON public.messages (lead_id, timestamp DESC)
  WHERE from_me = true AND is_auto_reply = false;

COMMENT ON COLUMN public.messages.is_auto_reply IS
  'true quando a mensagem outbound foi disparada por auto-reply (fora-de-horário, ack automático). Ignorada na regra de qualificação (I1).';

-- 2. leads.is_internal_contact: contatos B2B/administrativos vão fixos na coluna Administrativo (D2, I5)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_internal_contact boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_internal_contact
  ON public.leads (clinic_id)
  WHERE is_internal_contact = true;

COMMENT ON COLUMN public.leads.is_internal_contact IS
  'true para contatos administrativos/B2B (médicos parceiros, fornecedores, hospital, secretárias, dono). Não disparam regras comerciais; ficam fixos na coluna Administrativo (I5).';

-- 3. Validação de enums novos em custom_fields (tipo_atendimento, status_consulta, motivo_desqualificacao, pagamento_confirmado).
--    Usa trigger (não CHECK) para permitir migration retroativa e evolução do enum.
CREATE OR REPLACE FUNCTION public.validate_lead_custom_fields_enums()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tipo            text;
  v_status          text;
  v_motivo          text;
  v_pago            jsonb;
  allowed_tipo      text[] := ARRAY['consulta_psiquiatria','consulta_terapia','sessao_emt','sessao_cetamina'];
  allowed_status    text[] := ARRAY['agendada','realizada','no_show','cancelada','reagendada'];
  allowed_motivo    text[] := ARRAY['spam_propaganda','fora_perfil','sem_interesse','contato_invalido','duplicado','outro'];
BEGIN
  IF NEW.custom_fields IS NULL OR jsonb_typeof(NEW.custom_fields) <> 'object' THEN
    RETURN NEW;
  END IF;

  v_tipo   := NEW.custom_fields->>'tipo_atendimento';
  v_status := NEW.custom_fields->>'status_consulta';
  v_motivo := NEW.custom_fields->>'motivo_desqualificacao';
  v_pago   := NEW.custom_fields->'pagamento_confirmado';

  IF v_tipo IS NOT NULL AND NOT (v_tipo = ANY(allowed_tipo)) THEN
    RAISE EXCEPTION 'custom_fields.tipo_atendimento inválido: %. Permitidos: %', v_tipo, allowed_tipo;
  END IF;

  IF v_status IS NOT NULL AND NOT (v_status = ANY(allowed_status)) THEN
    RAISE EXCEPTION 'custom_fields.status_consulta inválido: %. Permitidos: %', v_status, allowed_status;
  END IF;

  IF v_motivo IS NOT NULL AND NOT (v_motivo = ANY(allowed_motivo)) THEN
    RAISE EXCEPTION 'custom_fields.motivo_desqualificacao inválido: %. Permitidos: %', v_motivo, allowed_motivo;
  END IF;

  IF v_pago IS NOT NULL AND jsonb_typeof(v_pago) <> 'boolean' THEN
    RAISE EXCEPTION 'custom_fields.pagamento_confirmado deve ser boolean, recebido: %', jsonb_typeof(v_pago);
  END IF;

  -- I6: qualificacao=desqualificado exige motivo_desqualificacao
  IF (NEW.custom_fields->>'qualificacao') = 'desqualificado' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'qualificacao=desqualificado exige custom_fields.motivo_desqualificacao (I6)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lead_custom_fields_enums ON public.leads;
CREATE TRIGGER trg_validate_lead_custom_fields_enums
  BEFORE INSERT OR UPDATE OF custom_fields ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.validate_lead_custom_fields_enums();

COMMENT ON FUNCTION public.validate_lead_custom_fields_enums() IS
  'Valida enums novos em leads.custom_fields (tipo_atendimento, status_consulta, motivo_desqualificacao, pagamento_confirmado) e a invariante I6.';

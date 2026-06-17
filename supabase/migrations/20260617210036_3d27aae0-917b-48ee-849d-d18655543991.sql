
-- =====================================================================
-- F1 — Reestruturação Pipeline Clínica ÓR (2026-06)
-- Pipeline-sombra: cria infra paralela sem tocar em leads existentes.
-- Roadmap: docs/roadmap/PIPELINE_RESTRUCTURE_2026_06.md
-- =====================================================================

-- ---------- 1. leads.shadow_of_lead_id ------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS shadow_of_lead_id uuid
    REFERENCES public.leads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_leads_shadow_of
  ON public.leads(shadow_of_lead_id)
  WHERE shadow_of_lead_id IS NOT NULL;

-- ---------- 2. View leads_live --------------------------------------
DROP VIEW IF EXISTS public.leads_live;
CREATE VIEW public.leads_live
  WITH (security_invoker = true)
  AS SELECT * FROM public.leads WHERE shadow_of_lead_id IS NULL;

GRANT SELECT ON public.leads_live TO authenticated;
GRANT ALL    ON public.leads_live TO service_role;

-- ---------- 3. Tabela appointments ----------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid NOT NULL DEFAULT current_clinic_id()
               REFERENCES public.clinics(id) ON DELETE CASCADE,
  lead_id      uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('consulta','procedimento','retorno')),
  scheduled_at timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'agendado'
               CHECK (status IN ('agendado','realizado','cancelado','faltou','remarcado')),
  notes        text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_clinic     ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_time  ON public.appointments(lead_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_upcoming
  ON public.appointments(clinic_id, scheduled_at)
  WHERE status = 'agendado';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL                            ON public.appointments TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY appointments_tenant_all ON public.appointments
  FOR ALL TO authenticated
  USING      ((clinic_id = current_clinic_id()) OR is_super_admin())
  WITH CHECK ((clinic_id = current_clinic_id()) OR is_super_admin());

CREATE TRIGGER trg_appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 4. recompute_lead_appointment_summary -------------------
-- Atualiza consulta_agendada_em / procedimento_agendado_em no lead a
-- partir do próximo appointment 'agendado'. Idempotente.
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
BEGIN
  SELECT clinic_id INTO v_clinic_id FROM public.leads WHERE id = _lead_id;
  IF v_clinic_id IS NULL THEN RETURN; END IF;

  SELECT MIN(scheduled_at) INTO v_next_consulta
    FROM public.appointments
   WHERE lead_id = _lead_id AND kind = 'consulta'
     AND status = 'agendado' AND scheduled_at > now();

  SELECT MIN(scheduled_at) INTO v_next_procedimento
    FROM public.appointments
   WHERE lead_id = _lead_id AND kind = 'procedimento'
     AND status = 'agendado' AND scheduled_at > now();

  UPDATE public.leads
     SET custom_fields = custom_fields
         || jsonb_build_object('consulta_agendada_em',
              COALESCE(to_jsonb(v_next_consulta::text), 'null'::jsonb))
         || jsonb_build_object('procedimento_agendado_em',
              COALESCE(to_jsonb(v_next_procedimento::text), 'null'::jsonb)),
         updated_at = now()
   WHERE id = _lead_id;
END;
$$;

-- Trigger que dispara o recompute ao mexer em appointments
CREATE OR REPLACE FUNCTION public.tg_appointments_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_lead_appointment_summary(OLD.lead_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_lead_appointment_summary(NEW.lead_id);
    IF TG_OP = 'UPDATE' AND OLD.lead_id IS DISTINCT FROM NEW.lead_id THEN
      PERFORM public.recompute_lead_appointment_summary(OLD.lead_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_appointments_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_appointments_recompute();

-- ---------- 5. Pipeline novo + 12 stages + 12 field-rules + 4 automações
-- Tudo via DO block para capturar IDs gerados.
DO $mig$
DECLARE
  v_clinic uuid := 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'; -- Clínica ÓR
  v_pipe   uuid;
  s_entrada uuid;  s_qualif uuid; s_cag uuid;  s_cfin uuid;
  s_pag    uuid;  s_ppago uuid;  s_emtr uuid; s_pant uuid;
  s_sresp  uuid;  s_nutr uuid;   s_b2b uuid;  s_desq uuid;
BEGIN
  -- 5.1 Pipeline (não-default, kind=sales)
  INSERT INTO public.pipelines (name, kind, color, position, is_default, clinic_id)
  VALUES ('Clínica ÓR (novo)', 'sales', '#0ea5e9', 99, false, v_clinic)
  RETURNING id INTO v_pipe;

  -- 5.2 Stages (10 funil + 2 laterais como is_terminal=true)
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'Leads de entrada',                   0,  '#94a3b8', false) RETURNING id INTO s_entrada;
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'Qualificação',                        1,  '#6366f1', false) RETURNING id INTO s_qualif;
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'Consulta agendada',                   2,  '#0ea5e9', false) RETURNING id INTO s_cag;
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'Consulta finalizada',                 3,  '#06b6d4', false) RETURNING id INTO s_cfin;
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'Procedimento agendado',               4,  '#8b5cf6', false) RETURNING id INTO s_pag;
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'Procedimento pago',                   5,  '#22c55e', false) RETURNING id INTO s_ppago;
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'Em tratamento',                       6,  '#14b8a6', false) RETURNING id INTO s_emtr;
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'Paciente antigo',                     7,  '#a3a3a3', false) RETURNING id INTO s_pant;
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'Sem resposta',                        8,  '#f59e0b', false) RETURNING id INTO s_sresp;
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'Nutrição inativa',                    9,  '#eab308', false) RETURNING id INTO s_nutr;
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'B2B / Stakeholders',                  10, '#64748b', true)  RETURNING id INTO s_b2b;
  INSERT INTO public.pipeline_stages (pipeline_id, clinic_id, name, position, color, is_terminal) VALUES
    (v_pipe, v_clinic, 'Desqualificado / Fora de escopo',     11, '#ef4444', true)  RETURNING id INTO s_desq;

  -- 5.3 Field-rules (engine = AND-only; OR vira múltiplas rules na mesma prio/destino)
  -- Risco clínico (prio 250) NÃO entra como field-rule — é tratado pelo trigger trg_lead_risk_handler.

  -- 200 — B2B / Stakeholders (OR expandido em 2 rules)
  INSERT INTO public.pipeline_field_rules (clinic_id, pipeline_id, target_stage_id, name, priority, enabled, conditions) VALUES
    (v_clinic, v_pipe, s_b2b, 'B2B (is_b2b)', 200, true,
      '[{"op":"is_true","field":"is_b2b"}]'::jsonb),
    (v_clinic, v_pipe, s_b2b, 'B2B (tipo_contato)', 200, true,
      '[{"op":"in","field":"tipo_contato","value":["b2b","fornecedor","imprensa"]}]'::jsonb);

  -- 180 — Fora de escopo (versão simplificada — campo "motivo" virá na F2)
  INSERT INTO public.pipeline_field_rules (clinic_id, pipeline_id, target_stage_id, name, priority, enabled, conditions) VALUES
    (v_clinic, v_pipe, s_desq, 'Desqualificado paciente', 180, true,
      '[{"op":"equals","field":"tipo_contato","value":"paciente"},{"op":"equals","field":"qualificacao","value":"desqualificado"}]'::jsonb);

  -- 170 — Procedimento pago
  INSERT INTO public.pipeline_field_rules (clinic_id, pipeline_id, target_stage_id, name, priority, enabled, conditions) VALUES
    (v_clinic, v_pipe, s_ppago, 'Procedimento pago', 170, true,
      '[{"op":"is_true","field":"pagamento_confirmado"},{"op":"in","field":"tipo_atendimento","value":["sessao_emt","sessao_cetamina"]}]'::jsonb);

  -- 160 — Procedimento agendado
  INSERT INTO public.pipeline_field_rules (clinic_id, pipeline_id, target_stage_id, name, priority, enabled, conditions) VALUES
    (v_clinic, v_pipe, s_pag, 'Procedimento agendado', 160, true,
      '[{"op":"not_empty","field":"procedimento_agendado_em"},{"op":"is_future","field":"procedimento_agendado_em"}]'::jsonb);

  -- 150 — Em tratamento (pacote ativo)
  INSERT INTO public.pipeline_field_rules (clinic_id, pipeline_id, target_stage_id, name, priority, enabled, conditions) VALUES
    (v_clinic, v_pipe, s_emtr, 'Em tratamento (pacote)', 150, true,
      '[{"op":"gte","field":"sessao_total","value":1},{"op":"gte","field":"saldo_sessoes_pacote","value":1}]'::jsonb);

  -- 140 — Consulta finalizada (decisão 2026-06-17)
  INSERT INTO public.pipeline_field_rules (clinic_id, pipeline_id, target_stage_id, name, priority, enabled, conditions) VALUES
    (v_clinic, v_pipe, s_cfin, 'Consulta finalizada', 140, true,
      '[{"op":"equals","field":"status_consulta","value":"realizada"},{"op":"is_empty","field":"procedimento_agendado_em"},{"op":"not_equals","field":"pagamento_confirmado","value":true}]'::jsonb);

  -- 130 — Consulta agendada
  INSERT INTO public.pipeline_field_rules (clinic_id, pipeline_id, target_stage_id, name, priority, enabled, conditions) VALUES
    (v_clinic, v_pipe, s_cag, 'Consulta agendada', 130, true,
      '[{"op":"not_empty","field":"consulta_agendada_em"},{"op":"is_future","field":"consulta_agendada_em"}]'::jsonb);

  -- 100 — Qualificação (OR expandido em 3 rules)
  INSERT INTO public.pipeline_field_rules (clinic_id, pipeline_id, target_stage_id, name, priority, enabled, conditions) VALUES
    (v_clinic, v_pipe, s_qualif, 'Qualificação (interessado)', 100, true,
      '[{"op":"in","field":"qualificacao","value":["interessado","em_negociacao"]}]'::jsonb),
    (v_clinic, v_pipe, s_qualif, 'Qualificação (tentou agendar)', 100, true,
      '[{"op":"is_true","field":"tentou_agendar"}]'::jsonb),
    (v_clinic, v_pipe, s_qualif, 'Qualificação (tentou pagamento)', 100, true,
      '[{"op":"is_true","field":"tentou_pagamento"}]'::jsonb);

  -- 80 — Paciente antigo (pacote zerado)
  INSERT INTO public.pipeline_field_rules (clinic_id, pipeline_id, target_stage_id, name, priority, enabled, conditions) VALUES
    (v_clinic, v_pipe, s_pant, 'Paciente antigo (pacote zerado)', 80, true,
      '[{"op":"gte","field":"sessao_total","value":1},{"op":"equals","field":"saldo_sessoes_pacote","value":0}]'::jsonb);

  -- 5.4 Automações (todas DESABILITADAS até cutover/F5)
  INSERT INTO public.automations
    (clinic_id, name, description, enabled, trigger_type, trigger_config, action_type, action_config, cooldown_hours) VALUES
    (v_clinic, '[novo] Qualificação 48h sem resposta → Sem resposta',
      'Move leads em Qualificação parados 48h para Sem resposta.', false,
      'no_reply_after', jsonb_build_object('hours', 48, 'stage_ids', jsonb_build_array(s_qualif::text)),
      'move_stage',     jsonb_build_object('stage_id', s_sresp::text), 24),
    (v_clinic, '[novo] Lembrete 24h antes da consulta',
      'IA-followup 24h antes do horário em consulta_agendada_em.', false,
      'before_appointment',
      jsonb_build_object('tz','America/Sao_Paulo','field_key','consulta_agendada_em',
                         'offset_unit','minutes','offset_minutes',1440,
                         'business_hours_only',true,'business_hours_start',10,'business_hours_end',22),
      'ai_followup', '{}'::jsonb, 24),
    (v_clinic, '[novo] Sem resposta 7d → Nutrição inativa',
      'Move para Nutrição inativa após 7 dias parado em Sem resposta.', false,
      'stage_idle', jsonb_build_object('days', 7, 'stage_ids', jsonb_build_array(s_sresp::text)),
      'move_stage', jsonb_build_object('stage_id', s_nutr::text), 24),
    (v_clinic, '[novo] Nutrição inativa 30d → revisar (placeholder)',
      'Engine ainda não tem action create_task — usando ai_followup como placeholder. Backlog: F-AUTOM-TASK.', false,
      'stage_idle', jsonb_build_object('days', 30, 'stage_ids', jsonb_build_array(s_nutr::text)),
      'ai_followup', '{}'::jsonb, 72);

  RAISE NOTICE 'Pipeline novo: %  | stages criados: 12  | field-rules: 12  | automações: 4', v_pipe;
END
$mig$;

-- ---------- 6. Trigger trg_lead_risk_handler (DESABILITADO até F6) --
CREATE OR REPLACE FUNCTION public.tg_lead_risk_handler()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_risk boolean := (NEW.custom_fields->>'risco_clinico')::boolean;
  v_old_risk boolean;
BEGIN
  IF NOT COALESCE(v_new_risk, false) THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_risk := (OLD.custom_fields->>'risco_clinico')::boolean;
    IF COALESCE(v_old_risk, false) = true THEN
      RETURN NEW; -- já estava marcado; não re-dispara
    END IF;
  END IF;

  NEW.manual_lock_until := GREATEST(COALESCE(NEW.manual_lock_until, now()), now() + interval '7 days');
  IF NOT ('risco_clinico' = ANY(COALESCE(NEW.tags, ARRAY[]::text[]))) THEN
    NEW.tags := array_append(COALESCE(NEW.tags, ARRAY[]::text[]), 'risco_clinico');
  END IF;

  INSERT INTO public.lead_tasks (lead_id, clinic_id, title, due_at)
  VALUES (NEW.id, NEW.clinic_id,
          'Revisar risco clínico do lead (auto)',
          now() + interval '2 hours');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_risk_handler
  BEFORE INSERT OR UPDATE OF custom_fields ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_lead_risk_handler();

-- Desabilita até F6
ALTER TABLE public.leads DISABLE TRIGGER trg_lead_risk_handler;

-- =====================================================================
-- Fim F1
-- =====================================================================

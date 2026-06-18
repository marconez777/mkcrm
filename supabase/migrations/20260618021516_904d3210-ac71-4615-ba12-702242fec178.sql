-- =====================================================
-- Marco 0 — Infra do pipeline v4.2
-- =====================================================

-- ---------- 1) Migrar leads de "Procedimento pago" (D1) ----------

-- Log histórico do move dos 9 leads (system source)
INSERT INTO public.lead_stage_history (clinic_id, lead_id, from_stage_id, to_stage_id, source, reason, metadata)
SELECT
  l.clinic_id,
  l.id,
  '166af8b0-62b1-422d-8742-f505f14bc1e6'::uuid,  -- Procedimento pago (a eliminar)
  '98320189-6002-4f75-b99d-0b407189efe8'::uuid,  -- Procedimento agendado (vira Tratamento agendado)
  'system:d1-eliminate-procedimento-pago',
  'Coluna "Procedimento pago" eliminada (D1 v4.2). Lead movido para "Tratamento agendado" com status_financeiro=pago.',
  jsonb_build_object('marco', '0', 'decision', 'D1')
FROM public.leads l
WHERE l.stage_id = '166af8b0-62b1-422d-8742-f505f14bc1e6'::uuid;

-- Mover leads + preservar status financeiro
UPDATE public.leads
SET
  stage_id = '98320189-6002-4f75-b99d-0b407189efe8'::uuid,
  stage_changed_at = now(),
  custom_fields = COALESCE(custom_fields, '{}'::jsonb) || jsonb_build_object('status_financeiro', 'pago')
WHERE stage_id = '166af8b0-62b1-422d-8742-f505f14bc1e6'::uuid;

-- ---------- 2) Renomear "Procedimento agendado" → "Tratamento agendado" (D2) ----------

UPDATE public.pipeline_stages
SET name = 'Tratamento agendado'
WHERE id = '98320189-6002-4f75-b99d-0b407189efe8'::uuid;

-- ---------- 3) Eliminar "Procedimento pago" (D1) ----------

DELETE FROM public.pipeline_stages
WHERE id = '166af8b0-62b1-422d-8742-f505f14bc1e6'::uuid;

-- ---------- 4) Recompactar positions 0..10 ----------

UPDATE public.pipeline_stages SET position = 5  WHERE id = '2a352661-01e2-41f8-be10-032f803e2387'::uuid; -- Em tratamento
UPDATE public.pipeline_stages SET position = 6  WHERE id = '7fea97d7-c2af-4e6f-8f39-af8375bb4468'::uuid; -- Paciente antigo
UPDATE public.pipeline_stages SET position = 7  WHERE id = '9f408ae6-649e-44b2-bc56-f93d138c87ed'::uuid; -- Sem resposta
UPDATE public.pipeline_stages SET position = 8  WHERE id = '64356dbe-3889-4b49-9429-260501cdb3d8'::uuid; -- Nutrição inativa
UPDATE public.pipeline_stages SET position = 9  WHERE id = '23a7bfd7-2baf-4d0f-8ed1-2b59b719020d'::uuid; -- B2B
UPDATE public.pipeline_stages SET position = 10 WHERE id = '35670cad-3f95-4e11-8f73-e8b27b865f89'::uuid; -- Desqualificado

-- ---------- 5) Colunas novas em `leads` ----------

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_processed_message_id_classifier uuid,
  ADD COLUMN IF NOT EXISTS last_processed_message_id_summarizer uuid;

COMMENT ON COLUMN public.leads.last_processed_message_id_classifier IS
  'Última mensagem já processada pelo pipeline-classify (Fase 2). NULL = ainda não processado.';
COMMENT ON COLUMN public.leads.last_processed_message_id_summarizer IS
  'Última mensagem já processada pelo pipeline-summarize (Fase 3). NULL = ainda não processado.';

-- ---------- 6) Tabela `stage_sequence_bindings` ----------

CREATE TABLE IF NOT EXISTS public.stage_sequence_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL,
  sequence_id uuid NOT NULL,
  trigger text NOT NULL DEFAULT 'on_enter' CHECK (trigger IN ('on_enter', 'on_exit')),
  enabled boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, stage_id, sequence_id, trigger)
);

COMMENT ON TABLE public.stage_sequence_bindings IS
  'Liga colunas do Kanban (pipeline_stages) a sequências de mensagens. Usado a partir da Fase 4 (v4.2) para C13/C14.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_sequence_bindings TO authenticated;
GRANT ALL ON public.stage_sequence_bindings TO service_role;

ALTER TABLE public.stage_sequence_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_sequence_bindings_clinic_scoped"
ON public.stage_sequence_bindings
FOR ALL
TO authenticated
USING (clinic_id = current_clinic_id())
WITH CHECK (clinic_id = current_clinic_id());

CREATE OR REPLACE FUNCTION public.touch_stage_sequence_bindings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stage_sequence_bindings_updated_at
  BEFORE UPDATE ON public.stage_sequence_bindings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_stage_sequence_bindings_updated_at();

-- ---------- 7) Toggles de automação (~25 chaves, todas OFF) ----------

INSERT INTO public.app_settings (key, value) VALUES
  -- Fase 1.1 — onboarding
  ('automation.novo_lead.enabled', 'false'),
  ('automation.secretary_replied.enabled', 'false'),
  -- Fase 1.2 — motor de appointments (5 regras)
  ('automation.appointment_agendado.enabled', 'false'),
  ('automation.appointment_realizado.enabled', 'false'),
  ('automation.appointment_faltou.enabled', 'false'),
  ('automation.appointment_cancelado.enabled', 'false'),
  ('automation.procedure_realizado.enabled', 'false'),
  -- Fase 1.3 — inatividade tiered (D4)
  ('automation.followup_24h.enabled', 'false'),
  ('automation.followup_3d.enabled', 'false'),
  ('automation.followup_7d_nutricao.enabled', 'false'),
  -- Fase 1.4 / 1.5 / 1.6 — outras determinísticas
  ('automation.reactivation.enabled', 'false'),
  ('automation.modality_guard.enabled', 'false'),
  ('automation.ciclo_concluido.enabled', 'false'),
  -- Fase 1.7 — reator humano (D7)
  ('automation.human_reactor.enabled', 'false'),
  -- Fase 2 — classifier LLM
  ('automation.classifier.enabled', 'false'),
  ('automation.classifier.history_tool_enabled', 'true'),
  ('automation.b2b_move.enabled', 'false'),
  ('automation.urgency_flag.enabled', 'false'),
  ('automation.field_patch.enabled', 'false'),
  ('automation.tags_merge.enabled', 'false'),
  ('automation.agendamento_sugerido.enabled', 'false'),
  -- Fase 2.5 — agentes auditores (v4.2)
  ('automation.position_auditor.enabled', 'false'),
  ('automation.position_auditor.batch_size', '50'),
  ('automation.post_move_verifier.enabled', 'false'),
  ('automation.post_move_verifier.rules_enabled', '[]'),
  -- Fase 3 — summarizer + tarefas
  ('automation.summarizer.enabled', 'false'),
  ('automation.nf_task.enabled', 'false'),
  ('automation.payment_confirmed.enabled', 'false')
ON CONFLICT (key) DO NOTHING;
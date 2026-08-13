-- =====================================================================
-- Travessia entre pipelines (Etapa 2 do PLANO_IMPLEMENTACAO — Clínica ÓR)
--
-- PROBLEMA
-- Nenhuma automação consegue mover um lead para outro pipeline: `resolveStageId`
-- filtra por `lead.pipeline_id`, então buscar coluna de outro funil devolve NULL
-- e a regra desiste em silêncio. Como o desenho alvo separa Vendas (P1) de
-- Pacientes (P2), a conversão — preencher a data e mover para "Consulta Agendada"
-- — passaria a atravessar funil e pararia de funcionar.
--
-- SOLUÇÃO
-- A travessia vira DADO, não efeito colateral. Só acontece se declarada em
-- `pipeline_crossings`. O helper `pipelineMove` recusa qualquer travessia
-- automática não declarada.
--
-- Hoje a tabela nasce VAZIA de propósito: nenhuma coluna foi movida para o P2
-- ainda, logo nenhuma travessia existe. As linhas são semeadas na Etapa 4, na
-- mesma transação que move as colunas.
--
-- Ver docs/tenants/clinica-or/FLUXO_ALVO.md §4
-- =====================================================================

-- ── 1) Tabela de travessias permitidas ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pipeline_crossings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  from_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  to_stage_id   uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  -- Qual regra pode usar esta travessia. Ex: 'field-changed-consulta'.
  -- '*' libera para qualquer origem automática.
  trigger_key   text NOT NULL DEFAULT '*',
  -- false = só humano atravessa (source 'manual' | 'ui')
  allow_auto    boolean NOT NULL DEFAULT true,
  enabled       boolean NOT NULL DEFAULT true,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_crossings_uk UNIQUE (from_stage_id, to_stage_id, trigger_key),
  CONSTRAINT pipeline_crossings_no_self CHECK (from_stage_id <> to_stage_id)
);

CREATE INDEX IF NOT EXISTS pipeline_crossings_lookup_idx
  ON public.pipeline_crossings (clinic_id, from_stage_id, to_stage_id)
  WHERE enabled;

ALTER TABLE public.pipeline_crossings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_scoped ON public.pipeline_crossings;
CREATE POLICY clinic_scoped ON public.pipeline_crossings
  FOR ALL TO authenticated
  USING (clinic_id = current_clinic_id())
  WITH CHECK (clinic_id = current_clinic_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_crossings TO authenticated;
GRANT ALL ON public.pipeline_crossings TO service_role;

COMMENT ON TABLE public.pipeline_crossings IS
  'Travessias permitidas entre pipelines. Automação só cruza funil se houver linha '
  'declarada e habilitada. Ver docs/tenants/clinica-or/FLUXO_ALVO.md §4';

-- ── 2) Histórico passa a registrar o funil ───────────────────────────────
-- Sem isto não há como medir conversão entre funis — que é o motivo de separar.
ALTER TABLE public.lead_stage_history
  ADD COLUMN IF NOT EXISTS from_pipeline_id uuid,
  ADD COLUMN IF NOT EXISTS to_pipeline_id   uuid;

CREATE INDEX IF NOT EXISTS lead_stage_history_crossing_idx
  ON public.lead_stage_history (clinic_id, from_pipeline_id, to_pipeline_id, moved_at DESC)
  WHERE from_pipeline_id IS DISTINCT FROM to_pipeline_id;

COMMENT ON COLUMN public.lead_stage_history.from_pipeline_id IS
  'Funil de origem. NULL em registros anteriores a 12/08/2026.';

-- ── 3) Trigger de histórico passa a preencher o funil ────────────────────
-- `trg_leads_sync_pipeline` roda BEFORE UPDATE e já derivou NEW.pipeline_id
-- quando este AFTER trigger executa, então OLD/NEW.pipeline_id são confiáveis.
CREATE OR REPLACE FUNCTION public.record_lead_stage_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.lead_stage_history
      (clinic_id, lead_id, from_stage_id, to_stage_id, moved_by_user_id, source,
       metadata, from_pipeline_id, to_pipeline_id)
    VALUES (
      NEW.clinic_id, NEW.id, OLD.stage_id, NEW.stage_id, v_user,
      CASE WHEN v_user IS NOT NULL THEN 'manual' ELSE 'system' END,
      '{}'::jsonb, OLD.pipeline_id, NEW.pipeline_id
    )
    ON CONFLICT (lead_id, to_stage_id, moved_at) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

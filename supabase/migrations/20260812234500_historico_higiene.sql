-- =====================================================================
-- Higiene do histórico de movimentação (Etapa 3 — Clínica ÓR)
--
-- DOIS PROBLEMAS MEDIDOS EM 11/08/2026
--
-- 1) DUPLICAÇÃO — 18% do histórico
--    1079 grupos duplicados / 1094 linhas extras sobre 6132 registros.
--    Causa: dois caminhos gravam a mesma movimentação em TRANSAÇÕES distintas —
--    o trigger `record_lead_stage_history` (durante o UPDATE) e o helper
--    `pipelineMove` logo depois. O índice único
--    `(lead_id, to_stage_id, moved_at)` não pega porque `now()` difere em
--    microssegundos entre as duas transações.
--
--    SOLUÇÃO: os dois passam a usar o MESMO instante canônico —
--    `leads.stage_changed_at`, que o trigger BEFORE `set_stage_changed_at` grava
--    com `now()` a cada troca de coluna. Com `moved_at` idêntico, o índice único
--    passa a colidir de verdade: o trigger cria a linha e o `pipelineMove` a
--    ENRIQUECE com source/reason/metadata em vez de criar uma segunda.
--
-- 2) HISTÓRICO CEGO — 47% das origens apontam para colunas apagadas
--    2895 de 6132 linhas referenciam etapas que não existem mais, herança da
--    deleção de um pipeline em 17/06. Como `from_stage_id`/`to_stage_id` não têm
--    foreign key, as linhas sobreviveram apontando para o vazio — e o nome se
--    perdeu para sempre.
--
--    SOLUÇÃO: gravar o NOME da coluna junto do id. Log de auditoria não pode
--    depender de FK viva para ser legível. Backfill preserva o que ainda dá.
--
-- Ver docs/tenants/clinica-or/auditoria-11-08-2026.md §3.2 e §3.3
-- =====================================================================

-- ── 1) Nome da coluna no próprio registro ────────────────────────────────
ALTER TABLE public.lead_stage_history
  ADD COLUMN IF NOT EXISTS from_stage_name text,
  ADD COLUMN IF NOT EXISTS to_stage_name   text;

COMMENT ON COLUMN public.lead_stage_history.to_stage_name IS
  'Nome da coluna no momento do movimento. Sobrevive a rename e a deleção — '
  'não confiar apenas em to_stage_id, que pode ficar órfão.';

-- ── 2) Backfill do que ainda é recuperável ───────────────────────────────
-- Roda antes de qualquer deleção de coluna. O que já está órfão é irrecuperável.
UPDATE public.lead_stage_history h
   SET from_stage_name = ps.name
  FROM public.pipeline_stages ps
 WHERE ps.id = h.from_stage_id
   AND h.from_stage_name IS NULL;

UPDATE public.lead_stage_history h
   SET to_stage_name = ps.name
  FROM public.pipeline_stages ps
 WHERE ps.id = h.to_stage_id
   AND h.to_stage_name IS NULL;

-- Backfill do pipeline (colunas criadas na migração anterior)
UPDATE public.lead_stage_history h
   SET from_pipeline_id = ps.pipeline_id
  FROM public.pipeline_stages ps
 WHERE ps.id = h.from_stage_id
   AND h.from_pipeline_id IS NULL;

UPDATE public.lead_stage_history h
   SET to_pipeline_id = ps.pipeline_id
  FROM public.pipeline_stages ps
 WHERE ps.id = h.to_stage_id
   AND h.to_pipeline_id IS NULL;

-- ── 3) Trigger: instante canônico + nomes + pipeline ─────────────────────
-- `moved_at` deixa de ser `DEFAULT now()` e passa a ser `NEW.stage_changed_at`,
-- gravado pelo trigger BEFORE `set_stage_changed_at`. É o mesmo valor que o
-- `pipelineMove` vai ler de volta — é isso que faz a deduplicação funcionar.
CREATE OR REPLACE FUNCTION public.record_lead_stage_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user     uuid := auth.uid();
  v_moved_at timestamptz := COALESCE(NEW.stage_changed_at, now());
  v_from_nm  text;
  v_to_nm    text;
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT name INTO v_from_nm FROM public.pipeline_stages WHERE id = OLD.stage_id;
    SELECT name INTO v_to_nm   FROM public.pipeline_stages WHERE id = NEW.stage_id;

    INSERT INTO public.lead_stage_history
      (clinic_id, lead_id, from_stage_id, to_stage_id, moved_by_user_id, source,
       metadata, from_pipeline_id, to_pipeline_id, from_stage_name, to_stage_name,
       moved_at)
    VALUES (
      NEW.clinic_id, NEW.id, OLD.stage_id, NEW.stage_id, v_user,
      CASE WHEN v_user IS NOT NULL THEN 'manual' ELSE 'system' END,
      '{}'::jsonb, OLD.pipeline_id, NEW.pipeline_id, v_from_nm, v_to_nm,
      v_moved_at
    )
    ON CONFLICT (lead_id, to_stage_id, moved_at) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 4) Limpeza das duplicatas já existentes ──────────────────────────────
-- ⚠️ IRREVERSÍVEL — apaga ~1094 linhas. Rodar antes, para conferir:
--
--   SELECT lead_id, to_stage_id, date_trunc('second', moved_at) AS seg,
--          count(*) AS n, array_agg(source) AS sources
--     FROM lead_stage_history
--    GROUP BY 1,2,3 HAVING count(*) > 1
--    ORDER BY n DESC LIMIT 20;
--
-- Mantém a linha mais informativa de cada grupo: source real (não 'system' nem
-- 'manual' genéricos) primeiro, depois a que tem `reason`, depois a mais antiga.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lead_id, to_stage_id, date_trunc('second', moved_at)
           ORDER BY (CASE WHEN source NOT IN ('system','manual','legacy','unknown') THEN 0 ELSE 1 END),
                    (CASE WHEN reason IS NOT NULL THEN 0 ELSE 1 END),
                    (CASE WHEN metadata <> '{}'::jsonb THEN 0 ELSE 1 END),
                    moved_at
         ) AS rn
  FROM public.lead_stage_history
)
DELETE FROM public.lead_stage_history h
USING ranked r
WHERE h.id = r.id AND r.rn > 1;

-- ── 5) O índice único NÃO muda — de propósito ────────────────────────────
-- Tentador trocar `(lead_id, to_stage_id, moved_at)` por `date_trunc('second',
-- moved_at)` para ser mais tolerante. NÃO FAZER: o trigger
-- `fn_clinica_or_wakeup_inbound` tem `ON CONFLICT (lead_id, to_stage_id,
-- moved_at)`, e trocar o índice deixaria essa inferência sem índice
-- correspondente — o INSERT passaria a levantar exceção e **quebraria a ingestão
-- de mensagens inbound da clínica**.
--
-- Não é necessário: com todos os caminhos usando `stage_changed_at` como instante
-- canônico, os valores ficam idênticos e o índice exato já colide. A tolerância
-- por segundo só seria útil contra um caminho futuro que ignore a convenção — e
-- aí a correção é o caminho, não o índice.

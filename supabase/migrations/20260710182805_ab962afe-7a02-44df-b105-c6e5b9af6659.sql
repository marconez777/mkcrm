-- G14: dual-tag na trigger de enfileiramento — mantém o carimbo legacy
-- (`pipeline-classifier`) usado pelo dispatcher V2 atual e adiciona o carimbo
-- por tenant (`pipeline-classifier:<slug>`) quando a clínica está no registry.
-- A troca completa (deprecar o legacy) acontece na virada do G5, quando o
-- template do G1 estiver rodando.

CREATE OR REPLACE FUNCTION public.tg_enqueue_classifier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug   text;
  v_tag_ns text;
BEGIN
  IF NEW.from_me IS NOT TRUE THEN
    -- Descobre o slug do tenant desta mensagem (JOIN leve — clinic_id vem do lead).
    SELECT ptc.slug INTO v_slug
    FROM public.leads l
    JOIN public.pipeline_tenant_classifiers ptc ON ptc.clinic_id = l.clinic_id
    WHERE l.id = NEW.lead_id;

    v_tag_ns := CASE WHEN v_slug IS NOT NULL THEN 'pipeline-classifier:' || v_slug END;

    UPDATE public.leads
    SET
      needs_ai_review     = true,
      ai_review_queued_at = COALESCE(ai_review_queued_at, now() + interval '5 seconds'),
      ai_review_reasons   = (
        SELECT ARRAY(
          SELECT DISTINCT unnest(
            COALESCE(ai_review_reasons, ARRAY[]::text[])
            || ARRAY['pipeline-classifier']
            || COALESCE(ARRAY[v_tag_ns]::text[], ARRAY[]::text[])
          )
          WHERE unnest IS NOT NULL
        )
      )
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END
$$;

-- Backfill dos leads já em fila para clínicas cadastradas no registry.
-- Não altera comportamento — só adiciona o carimbo novo.
UPDATE public.leads l
SET ai_review_reasons = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(l.ai_review_reasons, ARRAY[]::text[])
      || ARRAY['pipeline-classifier:' || ptc.slug]
    )
  )
)
FROM public.pipeline_tenant_classifiers ptc
WHERE ptc.clinic_id = l.clinic_id
  AND l.needs_ai_review = true
  AND NOT (l.ai_review_reasons @> ARRAY['pipeline-classifier:' || ptc.slug]);

COMMENT ON FUNCTION public.tg_enqueue_classifier() IS
  'G14 — Enfileira leads com dual-tag: carimbo legacy `pipeline-classifier` + carimbo por tenant `pipeline-classifier:<slug>` (quando a clínica está no registry pipeline_tenant_classifiers). Legacy será removido na virada do G5.';
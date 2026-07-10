-- Fix pós-G14: enfileirar só clínicas que têm agente configurado.
-- Elimina o desperdício de 516 leads sendo descartados a cada minuto.

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
    -- Só enfileira se a clínica tem agente no registry (evita fila-lixo).
    SELECT ptc.slug INTO v_slug
    FROM public.leads l
    JOIN public.pipeline_tenant_classifiers ptc ON ptc.clinic_id = l.clinic_id
    WHERE l.id = NEW.lead_id;

    IF v_slug IS NULL THEN
      RETURN NEW; -- clínica fora do registry: não enfileira.
    END IF;

    v_tag_ns := 'pipeline-classifier:' || v_slug;

    UPDATE public.leads
    SET
      needs_ai_review     = true,
      ai_review_queued_at = COALESCE(ai_review_queued_at, now() + interval '5 seconds'),
      ai_review_reasons   = (
        SELECT ARRAY(
          SELECT DISTINCT unnest(
            COALESCE(ai_review_reasons, ARRAY[]::text[])
            || ARRAY['pipeline-classifier', v_tag_ns]
          )
        )
      )
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END
$$;

COMMENT ON FUNCTION public.tg_enqueue_classifier() IS
  'G14 + fix: enfileira leads apenas de clínicas com agente no registry pipeline_tenant_classifiers. Dual-tag legacy `pipeline-classifier` + `pipeline-classifier:<slug>` mantido para transição.';
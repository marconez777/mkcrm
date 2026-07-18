CREATE OR REPLACE FUNCTION public.tg_enqueue_classifier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_registry boolean;
  v_version      text;
  v_tag_ns       text;
BEGIN
  IF NEW.from_me IS NOT TRUE THEN
    BEGIN
      -- Só enfileira se a clínica está no registry de classifier (evita fila-lixo).
      -- Schema real de pipeline_tenant_classifiers: (clinic_id, enabled, classifier_version, ...).
      -- Não existe coluna slug/edge_function_name/cron_enabled aqui.
      SELECT ptc.classifier_version
        INTO v_version
        FROM public.leads l
        JOIN public.pipeline_tenant_classifiers ptc
          ON ptc.clinic_id = l.clinic_id
       WHERE l.id = NEW.lead_id
         AND ptc.enabled = true
       LIMIT 1;

      v_has_registry := v_version IS NOT NULL;

      IF NOT v_has_registry THEN
        RETURN NEW; -- clínica fora do registry: não enfileira.
      END IF;

      v_tag_ns := 'pipeline-classifier:' || COALESCE(v_version, 'default');

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
    EXCEPTION WHEN OTHERS THEN
      -- Defesa em profundidade: NUNCA quebrar a ingestão de mensagens
      -- por causa de falha no enfileiramento do classifier.
      RAISE WARNING 'tg_enqueue_classifier failed for lead % : % / %', NEW.lead_id, SQLSTATE, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END
$function$;
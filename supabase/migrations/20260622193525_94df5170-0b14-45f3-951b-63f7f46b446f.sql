-- 1) Toggle (default ON) para a nova regra
INSERT INTO public.app_settings (key, value)
VALUES ('automation.reactivation_inbound.enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2) Trigger AFTER INSERT em messages para from_me=false
CREATE OR REPLACE FUNCTION public.tg_auto_reactivation_inbound()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.from_me IS FALSE OR NEW.from_me IS NULL THEN
    PERFORM public.notify_pipeline_deterministic(
      'reactivation-inbound',
      jsonb_build_object('message_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_messages_auto_reactivation_inbound ON public.messages;
CREATE TRIGGER trg_messages_auto_reactivation_inbound
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_reactivation_inbound();

-- 3) Backfill: para cada lead atualmente em "Nutrição Inativa (Geladeira de Leads)"
--    com inbound nos últimos 7 dias, reenfileira via notify usando a última
--    mensagem inbound conhecida. Isso passa pelo pipelineMove (gates + bindings).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT m.id AS message_id
    FROM public.leads l
    JOIN LATERAL (
      SELECT id
      FROM public.messages
      WHERE lead_id = l.id AND from_me IS FALSE
      ORDER BY created_at DESC
      LIMIT 1
    ) m ON TRUE
    JOIN public.pipeline_stages s ON s.id = l.stage_id
    WHERE l.archived_at IS NULL
      AND COALESCE(l.is_internal_contact, FALSE) = FALSE
      AND (s.name ILIKE '%nutri%inativ%' OR s.name ILIKE '%nutri%ç%antig%' OR s.name ILIKE '%nutricao antig%')
      AND COALESCE(l.last_inbound_at, l.last_message_at) > now() - interval '7 days'
  LOOP
    PERFORM public.notify_pipeline_deterministic(
      'reactivation-inbound',
      jsonb_build_object('message_id', r.message_id)
    );
  END LOOP;
END $$;
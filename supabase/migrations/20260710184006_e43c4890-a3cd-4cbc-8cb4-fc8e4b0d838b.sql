ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_processed_message_id_classifier_dry text;

COMMENT ON COLUMN public.leads.last_processed_message_id_classifier_dry IS
  'G9 — watermark isolado para execuções dry_run do pipeline-classifier (template por tenant). Avança independentemente de last_processed_message_id_classifier para que desligar dry_run não pule mensagens em produção.';
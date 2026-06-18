create or replace function public.reset_ai_classifications(p_clinic_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.leads set
    custom_fields = coalesce(custom_fields, '{}'::jsonb) - array[
      'qualificacao',
      'procedimento_interesse',
      'tentou_pagamento',
      'pagamento_confirmado',
      'tentou_agendar',
      'consulta_agendada_em',
      'procedimento_agendado_em'
    ]::text[],
    ai_summary = null,
    ai_summary_at = null,
    last_classified_at = null,
    last_processed_message_id_classifier = null,
    last_processed_message_id_summarizer = null,
    needs_ai_review = false,
    ai_review_reasons = null,
    ai_review_queued_at = null
  where clinic_id = p_clinic_id;
  get diagnostics n = row_count;

  delete from public.lead_thread_classifications where clinic_id = p_clinic_id;

  return n;
end;
$$;

revoke all on function public.reset_ai_classifications(uuid) from public;
revoke all on function public.reset_ai_classifications(uuid) from anon;
revoke all on function public.reset_ai_classifications(uuid) from authenticated;
grant execute on function public.reset_ai_classifications(uuid) to service_role;
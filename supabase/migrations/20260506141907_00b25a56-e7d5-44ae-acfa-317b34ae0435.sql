
-- Default clinic_id em todas as tabelas de domínio (puxa da sessão)
DO $$
DECLARE
  t text;
  domain_tables text[] := ARRAY[
    'whatsapp_instances','pipelines','pipeline_stages','attendants','leads','messages',
    'lead_events','lead_internal_notes','lead_tasks','lead_custom_fields',
    'lead_reply_counters','lead_ai_settings','quick_replies','message_templates',
    'scheduled_messages','pending_replies','ai_agents','ai_documents','ai_chunks',
    'ai_threads','ai_messages','agent_memory','agent_traces','agent_evals',
    'agent_mcp_servers','ai_usage','automations','automation_runs',
    'stage_ai_defaults','task_boards','task_columns','task_labels','tasks',
    'task_assignees','task_attachments','task_checklist_items','task_label_links',
    'webhook_events'
  ];
BEGIN
  FOREACH t IN ARRAY domain_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN clinic_id SET DEFAULT public.current_clinic_id()', t);
  END LOOP;
END $$;

-- Restringe execução de funções SECURITY DEFINER ao role authenticated
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_clinic_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_clinic_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_clinic_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_clinic_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_clinic_invite(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_clinic_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinic_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_clinic_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_clinic_invite(text) TO authenticated;

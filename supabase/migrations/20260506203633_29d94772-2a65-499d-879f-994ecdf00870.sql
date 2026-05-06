-- Remove o bypass de super_admin das policies de dados operacionais.
-- Super admin continua acessando via clinic_members (clinic_id = current_clinic_id()).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'attendants','pipeline_stages','leads','messages','lead_custom_fields',
    'webhook_events','quick_replies','lead_events','whatsapp_instances',
    'ai_documents','ai_chunks','ai_threads','ai_messages','lead_ai_settings',
    'stage_ai_defaults','automations','automation_runs','message_templates',
    'ai_usage','lead_internal_notes','lead_tasks','scheduled_messages',
    'agent_memory','agent_mcp_servers','pending_replies','agent_evals',
    'agent_traces','lead_reply_counters','pipelines',
    'task_boards','task_columns','tasks','task_assignees','task_labels',
    'task_label_links','task_checklist_items','task_attachments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS clinic_scoped ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY clinic_scoped ON public.%I FOR ALL TO authenticated USING (clinic_id = public.current_clinic_id()) WITH CHECK (clinic_id = public.current_clinic_id())',
      t
    );
  END LOOP;
END $$;

-- ai_agents tem policies separadas; ajusta também.
DROP POLICY IF EXISTS ai_agents_select ON public.ai_agents;
CREATE POLICY ai_agents_select ON public.ai_agents
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS ai_agents_admin_write ON public.ai_agents;
CREATE POLICY ai_agents_admin_write ON public.ai_agents
  FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());
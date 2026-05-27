
-- 1) Revogar SELECT de colunas sensíveis em whatsapp_instances para 'authenticated'
REVOKE SELECT (evolution_api_key, webhook_token) ON public.whatsapp_instances FROM authenticated;
-- service_role mantém acesso total (edge functions)

-- 2) Trocar policies que estão em PUBLIC para AUTHENTICATED
-- tracking_lead_sources
ALTER POLICY tracking_lead_sources_insert ON public.tracking_lead_sources TO authenticated;
ALTER POLICY tracking_lead_sources_select ON public.tracking_lead_sources TO authenticated;
ALTER POLICY tracking_lead_sources_update ON public.tracking_lead_sources TO authenticated;

-- traffic_source_rules
ALTER POLICY traffic_rules_insert ON public.traffic_source_rules TO authenticated;
ALTER POLICY traffic_rules_select ON public.traffic_source_rules TO authenticated;
ALTER POLICY traffic_rules_update ON public.traffic_source_rules TO authenticated;

-- tracking_identity_links
ALTER POLICY til_clinic_admin_write ON public.tracking_identity_links TO authenticated;
ALTER POLICY til_clinic_select ON public.tracking_identity_links TO authenticated;

-- broadcasts e tabelas relacionadas
ALTER POLICY broadcasts_clinic_access ON public.broadcasts TO authenticated;
ALTER POLICY bgroups_clinic_access ON public.broadcast_message_groups TO authenticated;
ALTER POLICY bparts_clinic_access ON public.broadcast_message_parts TO authenticated;
ALTER POLICY brecipients_clinic_access ON public.broadcast_recipients TO authenticated;
ALTER POLICY bevents_clinic_access ON public.broadcast_events TO authenticated;

-- whatsapp_intents
ALTER POLICY whatsapp_intents_select ON public.whatsapp_intents TO authenticated;
ALTER POLICY whatsapp_intents_write ON public.whatsapp_intents TO authenticated;

-- clinic_email_integrations (super_admin policy)
ALTER POLICY "Super admins manage all email integrations" ON public.clinic_email_integrations TO authenticated;

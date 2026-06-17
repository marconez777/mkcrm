
BEGIN;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY clinic_id, shadow_of_lead_id ORDER BY created_at, id) AS rn
  FROM public.leads
  WHERE shadow_of_lead_id IS NOT NULL
)
DELETE FROM public.leads l USING ranked r
WHERE l.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS leads_shadow_of_lead_id_uniq
  ON public.leads (clinic_id, shadow_of_lead_id)
  WHERE shadow_of_lead_id IS NOT NULL;

WITH stage_map(src_name, dst_name) AS (
  VALUES
    ('Leads de entrada','Leads de entrada'),
    ('Paciente antigo','Paciente antigo'),
    ('Retorno Tratamento Finalizado','Paciente antigo'),
    ('Qualificação','Qualificação'),
    ('Fechamento pendente consulta','Qualificação'),
    ('Fechamento pendente procedimento','Qualificação'),
    ('Consulta Agendada','Consulta agendada'),
    ('Consulta finalizada','Consulta finalizada'),
    ('Procedimento Agendado','Procedimento agendado'),
    ('Procedimento pago','Procedimento pago'),
    ('Antigo Consulta/procedimento agendado','Consulta agendada'),
    ('lead parou de responder','Sem resposta'),
    ('Lead não qualificado','Desqualificado / Fora de escopo'),
    ('Nutrição de Leads Inativos','Nutrição inativa'),
    ('Administrativo','B2B / Stakeholders')
),
needs_extract(src_name) AS (
  VALUES
    ('Leads de entrada'),('Paciente antigo'),('Qualificação'),
    ('Fechamento pendente consulta'),('Fechamento pendente procedimento'),
    ('Retorno Tratamento Finalizado'),('Antigo Consulta/procedimento agendado'),
    ('Consulta finalizada')
)
INSERT INTO public.leads (
  clinic_id, pipeline_id, stage_id, shadow_of_lead_id,
  phone, name, email, custom_fields, tags, is_internal_contact,
  whatsapp_instance_id, utm_source, utm_medium, utm_campaign, attendant_id,
  needs_ai_review, ai_review_queued_at, ai_review_reasons
)
SELECT
  o.clinic_id,
  '17c27f4d-8256-4ea7-b5b9-ed706494f686'::uuid,
  ds.id,
  o.id,
  o.phone, o.name, o.email,
  CASE
    WHEN (o.custom_fields->>'qualificacao') = 'desqualificado'
         AND (o.custom_fields->>'motivo_desqualificacao') IS NULL
      THEN o.custom_fields || jsonb_build_object('motivo_desqualificacao','outro')
    ELSE o.custom_fields
  END,
  ARRAY(SELECT DISTINCT unnest(o.tags || ARRAY['shadow'])),
  o.is_internal_contact,
  o.whatsapp_instance_id, o.utm_source, o.utm_medium, o.utm_campaign, o.attendant_id,
  (ne.src_name IS NOT NULL AND NOT o.is_internal_contact),
  CASE WHEN (ne.src_name IS NOT NULL AND NOT o.is_internal_contact) THEN now() ELSE NULL END,
  CASE WHEN ne.src_name IS NOT NULL THEN ARRAY['shadow_build_2026_06']::text[] ELSE ARRAY[]::text[] END
FROM public.leads o
JOIN public.pipeline_stages ss ON ss.id = o.stage_id
JOIN stage_map sm ON sm.src_name = ss.name
JOIN public.pipeline_stages ds
  ON ds.pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
 AND ds.name = sm.dst_name
LEFT JOIN needs_extract ne ON ne.src_name = ss.name
WHERE o.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
  AND o.pipeline_id = '737242e7-8efc-4a8f-9fed-f09c6e5dc227'
  AND o.shadow_of_lead_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.leads s
    WHERE s.shadow_of_lead_id = o.id AND s.clinic_id = o.clinic_id
  );

COMMIT;

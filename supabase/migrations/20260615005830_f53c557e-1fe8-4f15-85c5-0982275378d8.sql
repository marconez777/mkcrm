WITH target_stage AS (
  SELECT id, pipeline_id FROM pipeline_stages
   WHERE id='f3c8307e-b636-41d1-9f79-6f0ec4313f8a'
), candidates AS (
  SELECT l.id, l.stage_id AS old_stage_id, l.pipeline_id AS old_pipeline_id
    FROM leads l
   WHERE l.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
     AND l.archived_at IS NULL
     AND NOT l.is_internal_contact
     AND (
       l.name ~* '^\s*(dr\.?|dra\.?|prof\.?|profa\.?|enf\.?|enfa\.?)\s+\S+'
       OR l.name ~* '\m(agência|agencia|distribuidora|hospital|laboratório|laboratorio|farmácia|farmacia|farma|comercial|fornecedor|representante)\M'
     )
), updated AS (
  UPDATE leads l
     SET is_internal_contact = true,
         stage_id = ts.id,
         pipeline_id = ts.pipeline_id,
         stage_changed_at = now()
    FROM candidates c, target_stage ts
   WHERE l.id = c.id
   RETURNING l.id, l.clinic_id, c.old_stage_id, ts.id AS new_stage_id
)
INSERT INTO lead_stage_history (clinic_id, lead_id, from_stage_id, to_stage_id, reason)
SELECT clinic_id, id, old_stage_id, new_stage_id, 'onda5_admin_backfill (I5/B14/B19)'
  FROM updated
 WHERE old_stage_id IS DISTINCT FROM new_stage_id;

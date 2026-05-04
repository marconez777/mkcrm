-- Identifica os leads duplicados a serem mesclados
CREATE TEMP TABLE dupes AS
WITH ranked AS (
  SELECT id, name, phone,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY length(phone) ASC, last_message_at DESC NULLS LAST) AS rn
  FROM public.leads WHERE name IS NOT NULL
),
keepers AS (SELECT name, id AS keep_id FROM ranked WHERE rn = 1)
SELECT l.id AS dup_id, k.keep_id
FROM public.leads l
JOIN keepers k ON k.name = l.name
WHERE l.id <> k.keep_id AND length(l.phone) > 13;

-- Deleta mensagens do duplicado que JÁ existem no keeper (mesmo external_id)
DELETE FROM public.messages m
USING dupes d
WHERE m.lead_id = d.dup_id
  AND m.external_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.messages m2
    WHERE m2.lead_id = d.keep_id AND m2.external_id = m.external_id
  );

-- Reaponta mensagens restantes
UPDATE public.messages m SET lead_id = d.keep_id FROM dupes d WHERE m.lead_id = d.dup_id;
UPDATE public.lead_internal_notes n SET lead_id = d.keep_id FROM dupes d WHERE n.lead_id = d.dup_id;
UPDATE public.lead_tasks t SET lead_id = d.keep_id FROM dupes d WHERE t.lead_id = d.dup_id;
UPDATE public.scheduled_messages sm SET lead_id = d.keep_id FROM dupes d WHERE sm.lead_id = d.dup_id;
UPDATE public.lead_events e SET lead_id = d.keep_id FROM dupes d WHERE e.lead_id = d.dup_id;
DELETE FROM public.lead_ai_settings s USING dupes d WHERE s.lead_id = d.dup_id;
DELETE FROM public.ai_threads th USING dupes d WHERE th.lead_id = d.dup_id;

-- Remove os duplicados (e LIDs órfãos sem mensagens)
DELETE FROM public.leads l USING dupes d WHERE l.id = d.dup_id;
DELETE FROM public.leads l
WHERE length(l.phone) > 13
  AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.lead_id = l.id);

-- Recalcula previews
UPDATE public.leads lk
SET last_message_at = sub.last_ts, last_message_preview = sub.preview
FROM (
  SELECT m.lead_id, MAX(m.timestamp) AS last_ts,
    (SELECT content FROM public.messages WHERE lead_id = m.lead_id ORDER BY timestamp DESC LIMIT 1) AS preview
  FROM public.messages m GROUP BY m.lead_id
) sub
WHERE lk.id = sub.lead_id;

CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_unique ON public.leads(phone);

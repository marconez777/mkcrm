-- 1) Telefone canônico de cada mensagem a partir de raw.key
CREATE TEMP TABLE msg_canonical AS
SELECT m.id AS msg_id,
       m.lead_id AS old_lead_id,
       m.external_id,
       m.from_me,
       m."timestamp" AS ts,
       m.raw->>'pushName' AS push_name,
       CASE
         WHEN (m.raw->'key'->>'remoteJidAlt') LIKE '%@s.whatsapp.net'
           THEN regexp_replace(split_part(m.raw->'key'->>'remoteJidAlt', '@', 1), '\D', '', 'g')
         WHEN (m.raw->'key'->>'remoteJid') LIKE '%@s.whatsapp.net'
           THEN regexp_replace(split_part(m.raw->'key'->>'remoteJid', '@', 1), '\D', '', 'g')
         ELSE NULL
       END AS phone
FROM public.messages m;

DELETE FROM msg_canonical
WHERE phone IS NULL OR length(phone) < 8 OR length(phone) > 15;

-- 2) Garante que existe um lead para cada telefone canônico
INSERT INTO public.leads (phone, stage_id)
SELECT DISTINCT mc.phone, (SELECT id FROM public.pipeline_stages ORDER BY position LIMIT 1)
FROM msg_canonical mc
LEFT JOIN public.leads l ON l.phone = mc.phone
WHERE l.id IS NULL
ON CONFLICT (phone) DO NOTHING;

-- 3) Mapa msg_id -> lead canônico
CREATE TEMP TABLE msg_target AS
SELECT mc.msg_id, mc.old_lead_id, mc.external_id, l.id AS new_lead_id
FROM msg_canonical mc
JOIN public.leads l ON l.phone = mc.phone;

-- 4) Apaga mensagens cuja external_id já existe no lead correto
DELETE FROM public.messages m
USING msg_target mt
WHERE m.id = mt.msg_id
  AND m.external_id IS NOT NULL
  AND mt.old_lead_id <> mt.new_lead_id
  AND EXISTS (
    SELECT 1 FROM public.messages m2
    WHERE m2.lead_id = mt.new_lead_id
      AND m2.external_id = m.external_id
      AND m2.id <> m.id
  );

-- 5) Move as mensagens restantes para o lead correto
UPDATE public.messages m
SET lead_id = mt.new_lead_id
FROM msg_target mt
WHERE m.id = mt.msg_id
  AND mt.old_lead_id <> mt.new_lead_id;

-- 6) Restaura nomes a partir do último pushName de mensagem RECEBIDA
CREATE TEMP TABLE name_candidates AS
SELECT DISTINCT ON (m.lead_id) m.lead_id, m.raw->>'pushName' AS push_name
FROM public.messages m
WHERE m.from_me = false
  AND m.raw->>'pushName' IS NOT NULL
  AND m.raw->>'pushName' <> ''
ORDER BY m.lead_id, m."timestamp" DESC;

UPDATE public.leads l
SET name = nc.push_name
FROM name_candidates nc
WHERE l.id = nc.lead_id
  AND nc.push_name <> l.phone
  AND (l.name IS NULL OR l.name = '' OR l.name = l.phone
       OR l.name IN ('MK','Você','muchacho'));

-- Limpa nomes claramente errados (vieram do próprio usuário) sem confirmação por mensagem recebida
UPDATE public.leads l
SET name = NULL
WHERE l.name IN ('Você','MK','muchacho')
  AND NOT EXISTS (
    SELECT 1 FROM name_candidates nc WHERE nc.lead_id = l.id AND nc.push_name = l.name
  );

-- 7) Recalcula preview / last_message_at e zera não lidas dos leads afetados
UPDATE public.leads lk
SET last_message_at = sub.last_ts,
    last_message_preview = sub.preview,
    unread_count = 0
FROM (
  SELECT m.lead_id,
         MAX(m."timestamp") AS last_ts,
         (SELECT content FROM public.messages
           WHERE lead_id = m.lead_id ORDER BY "timestamp" DESC LIMIT 1) AS preview
  FROM public.messages m
  GROUP BY m.lead_id
) sub
WHERE lk.id = sub.lead_id;

-- 8) Remove leads vazios e sem dados manuais (evita "fantasmas" depois da limpeza)
DELETE FROM public.leads l
WHERE NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.lead_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM public.lead_internal_notes n WHERE n.lead_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM public.lead_tasks t WHERE t.lead_id = l.id)
  AND l.archived_at IS NULL
  AND COALESCE(l.notes, '') = ''
  AND l.email IS NULL
  AND l.deal_value IS NULL
  AND l.created_at < now() - interval '1 minute';
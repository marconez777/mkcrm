-- =====================================================================
-- RLS de email_logs / email_queue em InitPlan + contagem de campanha no servidor
--
-- Sintoma (21/08/2026, tenant MCD): Email > Campanhas mostrava "1–6 de 6" e
-- "Nenhuma campanha ainda". A tela contava as campanhas (count=exact) e em
-- seguida baixava TODAS as linhas de email_logs e email_queue das campanhas
-- da página para recalcular enviados/falhas no navegador. No MCD (campanhas
-- de ~146k destinatários) são centenas de milhares de linhas sob a policy
-- avaliada por linha → statement_timeout (8s) → 500 → o load() abortava
-- antes de renderizar a lista.
--
-- Mesma causa de 20260821120000_esc_rls_initplan.sql, agora nas duas tabelas
-- mais volumosas do módulo. Duas frentes:
--   1) policies de SELECT de email_logs e email_queue passam a usar
--      accessible_clinic_ids() (InitPlan: uma avaliação por query). As
--      policies de escrita (email_queue_admin_insert/update/delete) ficam
--      como estão — escrita é por statement pequeno e os workers usam
--      service_role.
--   2) campaign_send_counts(): conta enviados/falhas no servidor, por
--      campanha, via email_logs_related_idx (clinic_id, related_lead_table).
--      A tela recebe 3 números por campanha em vez de baixar linhas.
--      Semântica igual à que a tela calculava no navegador:
--        sent   = linhas em email_logs do contexto campaign_<id>
--        failed = email_logs com status bounced/complained/failed
--               + email_queue com status failed
-- =====================================================================

-- 1) Policies de leitura ------------------------------------------------

DROP POLICY IF EXISTS email_logs_read ON public.email_logs;
DROP POLICY IF EXISTS email_logs_admin_read ON public.email_logs;      -- nome antigo (20260618), só leitura
CREATE POLICY email_logs_read ON public.email_logs
  FOR SELECT TO authenticated
  USING (clinic_id = ANY ((SELECT public.accessible_clinic_ids('email_marketing'))::uuid[]));

DROP POLICY IF EXISTS email_queue_select ON public.email_queue;
DROP POLICY IF EXISTS email_queue_admin_select ON public.email_queue;  -- nome antigo (20260618), só leitura
CREATE POLICY email_queue_select ON public.email_queue
  FOR SELECT TO authenticated
  USING (clinic_id = ANY ((SELECT public.accessible_clinic_ids('email_marketing'))::uuid[]));

-- 2) Contagem por campanha no servidor ---------------------------------

CREATE OR REPLACE FUNCTION public.campaign_send_counts(_clinic_id uuid, _campaign_ids uuid[])
RETURNS TABLE(campaign_id uuid, sent bigint, failed bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id AS campaign_id,
         l.sent,
         l.failed + q.failed AS failed
  FROM unnest(_campaign_ids) AS c(id)
  CROSS JOIN LATERAL (
    SELECT count(*) AS sent,
           count(*) FILTER (WHERE status IN ('bounced', 'complained', 'failed')) AS failed
    FROM public.email_logs
    WHERE clinic_id = _clinic_id
      AND related_lead_table = 'campaign_' || c.id::text
  ) AS l
  CROSS JOIN LATERAL (
    SELECT count(*) AS failed
    FROM public.email_queue
    WHERE clinic_id = _clinic_id
      AND related_lead_table = 'campaign_' || c.id::text
      AND status = 'failed'
  ) AS q
  WHERE public.has_clinic_access(_clinic_id)
    AND public.clinic_has_feature(_clinic_id, 'email_marketing');
$$;

COMMENT ON FUNCTION public.campaign_send_counts(uuid, uuid[]) IS
  'Enviados/falhas por campanha (email_logs + email_queue.failed), agregados '
  'no servidor. Usado por Email > Campanhas no lugar de baixar as linhas. '
  'Devolve vazio se o usuário não tem acesso à clínica ou a feature está off.';

REVOKE EXECUTE ON FUNCTION public.campaign_send_counts(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_send_counts(uuid, uuid[]) TO authenticated, service_role;

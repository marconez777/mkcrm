-- =====================================================================
-- email_segment_preview — contagem e amostra de destinatários no servidor
--
-- Sintoma (21/08/2026, tenant MCD): o card "Destinatários" do modal de nova
--   campanha ficava girando para sempre com o segmento "Desafio" selecionado.
--
-- Causa: `CampaignRecipientsPreview.tsx` **baixava a lista inteira** só para
--   mostrar um número. Para 146k contatos isso é:
--     • ~147 chamadas sequenciais de `resolve_email_segment` com .range() —
--       e cada página **recalcula o conjunto inteiro** (PostgREST aplica
--       LIMIT/OFFSET por fora da função). É quadrático: 147 × 146k linhas.
--     • dedup de 146k e-mails no navegador;
--     • ~294 consultas `.in()` de 500 e-mails a `email_unsubscribes`, cada
--       uma com uma URI de ~15 KB.
--   São ~440 idas ao servidor em série. Nunca termina dentro do tempo em que
--   alguém espera olhando a tela.
--
-- Correção: uma RPC que devolve `{total, unsubscribed, sample}` numa query.
--   `resolve_email_segment` roda **uma vez por segmento** (não 147), o dedup
--   vira DISTINCT ON e a supressão vira LEFT JOIN contra o conjunto de
--   descadastros da clínica — nada trafega além do JSON de resposta.
--
-- Ver docs/roadmap/EMAIL_ESCALA.md — G-04 e F3.2, e a invariante do §6:
-- "nenhuma tela do módulo baixa lista de destinatários para contar".
--
-- Semântica preservada da tela antiga:
--   • sem segmento = todos os leads com e-mail + todos os contatos importados
--     da clínica (o mesmo público que `dispatch-campaign` monta);
--   • dedup por e-mail em minúsculas;
--   • `total` conta o público inteiro e `unsubscribed` a parte suprimida —
--     quem envia é `total - unsubscribed`;
--   • a amostra mostra só quem receberia (descadastrado não aparece).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.email_segment_preview(
  _clinic_id uuid,
  _segment_ids uuid[] DEFAULT '{}'::uuid[],
  _sample_limit int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _out  jsonb;
  _segs uuid[] := COALESCE(_segment_ids, '{}'::uuid[]);
  _n    int    := COALESCE(array_length(_segs, 1), 0);
  _lim  int    := LEAST(GREATEST(COALESCE(_sample_limit, 20), 0), 100);
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.has_clinic_access(_clinic_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Segmento de outra clínica não entra na conta desta. `resolve_email_segment`
  -- já faz o próprio controle de acesso, mas quem acessa duas clínicas poderia
  -- somar o público de uma na prévia da outra.
  IF _n > 0 AND EXISTS (
       SELECT 1
         FROM unnest(_segs) AS s(id)
         LEFT JOIN public.email_segments es ON es.id = s.id
        WHERE es.id IS NULL OR es.clinic_id <> _clinic_id
     ) THEN
    RAISE EXCEPTION 'segmento inexistente ou de outra clinica';
  END IF;

  WITH raw AS (
    -- Com segmento: uma execução por segmento, não uma por página.
    SELECT lower(r.email) AS email, r.name
      FROM unnest(_segs) AS s(id)
      CROSS JOIN LATERAL public.resolve_email_segment(s.id) AS r
    UNION ALL
    -- Sem segmento: leads com e-mail + contatos importados (mesmo público
    -- que o dispatch monta quando `segment_ids` vem vazio).
    SELECT lower(l.email), l.name
      FROM public.leads l
     WHERE _n = 0
       AND l.clinic_id = _clinic_id
       AND l.email IS NOT NULL AND l.email <> ''
    UNION ALL
    SELECT lower(c.email), c.name
      FROM public.email_segment_contacts c
     WHERE _n = 0
       AND c.clinic_id = _clinic_id
       AND c.email IS NOT NULL AND c.email <> ''
  ),
  unsub AS (
    SELECT DISTINCT lower(u.email) AS email
      FROM public.email_unsubscribes u
     WHERE u.clinic_id = _clinic_id
  ),
  dedup AS (
    SELECT DISTINCT ON (r.email) r.email, r.name
      FROM raw r
     WHERE r.email IS NOT NULL AND r.email <> '' AND r.email LIKE '%@%'
     ORDER BY r.email, r.name NULLS LAST
  ),
  marked AS (
    SELECT d.email, d.name, (u.email IS NOT NULL) AS is_unsub
      FROM dedup d
      LEFT JOIN unsub u ON u.email = d.email
  )
  SELECT jsonb_build_object(
           'total',        (SELECT count(*) FROM marked),
           'unsubscribed', (SELECT count(*) FROM marked WHERE is_unsub),
           'sample',       COALESCE(
             (SELECT jsonb_agg(to_jsonb(t))
                FROM (SELECT m.email, m.name
                        FROM marked m
                       WHERE NOT m.is_unsub
                       ORDER BY m.email
                       LIMIT _lim) t),
             '[]'::jsonb)
         )
    INTO _out;

  RETURN COALESCE(
    _out,
    jsonb_build_object('total', 0, 'unsubscribed', 0, 'sample', '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.email_segment_preview(uuid, uuid[], int) IS
  'Prévia de destinatários de campanha: {total, unsubscribed, sample} numa '
  'única query. Substitui a paginação de resolve_email_segment no navegador '
  '(G-04 do docs/roadmap/EMAIL_ESCALA.md). Sem segmentos = leads com e-mail + '
  'contatos importados da clínica.';

REVOKE EXECUTE ON FUNCTION public.email_segment_preview(uuid, uuid[], int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.email_segment_preview(uuid, uuid[], int) TO authenticated, service_role;

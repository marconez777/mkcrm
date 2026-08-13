-- =====================================================================
-- Etapa 5.1 — coluna Reagendamento resolvível por regra (Clínica ÓR)
--
-- A coluna foi criada no Bloco A e as colunas migraram no Bloco B, mas
-- Reagendamento nunca ganhou apelido canônico — nenhuma regra consegue
-- resolvê-la como destino.
--
-- Passa a ser destino de:
--   • compromisso marcado como `faltou`     (antes: Sem resposta, no funil errado)
--   • compromisso marcado como `cancelado`  (antes: Qualificação, rebaixava paciente)
--
-- Ver docs/tenants/clinica-or/FLUXO_ALVO.md §3
-- =====================================================================

DO $$
DECLARE
  v_clinic uuid := 'cf038458-457d-4c1a-9ac4-c88c3c8353a1';
  v_stage  uuid;
  v_pipe   uuid;
BEGIN
  SELECT s.id, s.pipeline_id INTO v_stage, v_pipe
    FROM public.pipeline_stages s
    JOIN public.pipelines p ON p.id = s.pipeline_id
   WHERE p.clinic_id = v_clinic
     AND s.name = 'Reagendamento';

  IF v_stage IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: coluna "Reagendamento" não encontrada';
  END IF;

  -- Apelido canônico
  INSERT INTO public.stage_canonical_aliases
    (clinic_id, pipeline_id, stage_id, canonical_name)
  VALUES (v_clinic, v_pipe, v_stage, 'Reagendamento')
  ON CONFLICT (pipeline_id, canonical_name) DO NOTHING;

  -- Travessia de borda: compromisso marcado como faltou/cancelado para um lead
  -- que ainda esteja no funil de Vendas. Raro, mas sem a declaração seria
  -- recusado em silêncio pelo gate G9.
  INSERT INTO public.pipeline_crossings
    (clinic_id, from_stage_id, to_stage_id, trigger_key, allow_auto, note)
  SELECT v_clinic, src.id, v_stage, 'auto:appointment-sync', true,
         'Falta/cancelamento de lead ainda em Vendas → fila de Reagendamento'
    FROM public.pipeline_stages src
   WHERE src.pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
     AND src.id <> v_stage
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Reagendamento canônico OK — stage %', v_stage;
END
$$;

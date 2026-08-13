-- =====================================================================
-- BLOCO B — Separação em dois pipelines (Etapa 4 — Clínica ÓR)
--
-- ⛔ NÃO RODAR ANTES DE FAZER O DEPLOY DO CÓDIGO DAS ETAPAS 1–3.
--    Sem o `pipelineMove` novo, no instante em que as colunas mudarem de funil:
--      • o gatilho de data para de converter (resolveStageId devolve null);
--      • qualquer travessia levanta exceção de coerência.
--    A ordem é: deploy do código → este script.
--
-- Move 5 colunas do funil de Vendas para o novo funil de Pacientes, funde
-- Nutrição Antigos em Paciente Inativo e declara as travessias permitidas.
--
-- O QUE NÃO É TOCADO: `messages`, `lead_events`, `leads.id`. O histórico só
-- ganha linhas novas (a migração real dos 415). Nada é apagado.
--
-- Ver docs/tenants/clinica-or/FLUXO_ALVO.md e PLANO_IMPLEMENTACAO.md §3 Etapa 4
-- =====================================================================

BEGIN;

-- ── 0) BACKUP — permite reconstruir a alocação anterior ──────────────────
CREATE TABLE IF NOT EXISTS public._bkp_20260813_leads_stage AS
SELECT id, clinic_id, stage_id, pipeline_id, now() AS snapshot_at
FROM public.leads
WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1';

CREATE TABLE IF NOT EXISTS public._bkp_20260813_stages AS
SELECT *, now() AS snapshot_at FROM public.pipeline_stages
WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1';

CREATE TABLE IF NOT EXISTS public._bkp_20260813_aliases AS
SELECT *, now() AS snapshot_at FROM public.stage_canonical_aliases
WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1';

-- ── 1) Mover 5 colunas para o funil de Pacientes ─────────────────────────
-- Os leads NÃO se movem: `stage_id` continua o mesmo. O que muda é onde a
-- coluna vive. `leads.pipeline_id` fica temporariamente defasado e é corrigido
-- no passo 4 — dentro desta mesma transação, então ninguém vê o estado
-- intermediário.
UPDATE public.pipeline_stages
   SET pipeline_id = (SELECT id FROM public.pipelines
                       WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
                         AND name = 'Clínica ÓR — Pacientes')
 WHERE id IN (
   'e12f004a-6445-4815-8d6b-22f928507a9a',  -- Consulta agendada
   '98320189-6002-4f75-b99d-0b407189efe8',  -- Tratamento agendado
   '7584241f-6e4b-4824-aaea-e271e865227d',  -- Consulta finalizada
   '2a352661-01e2-41f8-be10-032f803e2387',  -- Tratamento Finalizado
   '7fea97d7-c2af-4e6f-8f39-af8375bb4468'   -- Paciente antigo
 );

-- ── 2) Paciente antigo → Paciente Inativo ────────────────────────────────
UPDATE public.pipeline_stages
   SET name = 'Paciente Inativo'
 WHERE id = '7fea97d7-c2af-4e6f-8f39-af8375bb4468';

-- ── 3) 🔴 CRÍTICO — corrigir os aliases canônicos ────────────────────────
-- `stage_canonical_aliases` guarda pipeline_id E stage_id. Sem isto, o alias
-- continua dizendo "Vendas" para uma coluna que agora vive em "Pacientes" e
-- TODA regra de agendamento para de resolver.
UPDATE public.stage_canonical_aliases a
   SET pipeline_id = ps.pipeline_id
  FROM public.pipeline_stages ps
 WHERE ps.id = a.stage_id
   AND a.pipeline_id IS DISTINCT FROM ps.pipeline_id;

-- ── 4) Resincronizar `leads.pipeline_id` ─────────────────────────────────
-- Só `pipeline_id` no SET: `stage_id` fora da lista mantém inertes os triggers
-- `trg_lead_stage_history`, `trg_enroll_on_stage_change` e `on_b2b_stage_move`
-- (todos `OF stage_id`). Zero linha falsa de histórico, zero inscrição em
-- sequência. Afeta ~220 leads.
UPDATE public.leads l
   SET pipeline_id = ps.pipeline_id
  FROM public.pipeline_stages ps
 WHERE ps.id = l.stage_id
   AND l.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
   AND l.pipeline_id IS DISTINCT FROM ps.pipeline_id;

-- ── 5) Fundir Nutrição Antigos em Paciente Inativo (415 leads) ───────────
-- `stage_id` E `pipeline_id` no MESMO statement: `trg_leads_enforce_coherence`
-- roda ANTES de `trg_leads_sync_pipeline` (ordem alfabética) e exigiria os dois
-- coerentes — mandar só `stage_id` levantaria exceção.
--
-- Este é o único passo que gera histórico, e corretamente: é movimentação real.
-- ⚠️ Exige `stage_sequence_bindings.enabled = false` (confirmado em 12/08),
--    senão inscreveria os 415 na cadência de uma vez.
UPDATE public.leads
   SET stage_id    = '7fea97d7-c2af-4e6f-8f39-af8375bb4468',
       pipeline_id = (SELECT pipeline_id FROM public.pipeline_stages
                       WHERE id = '7fea97d7-c2af-4e6f-8f39-af8375bb4468')
 WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
   AND stage_id  = '9de8e54e-7edb-47dd-b613-de22276d8ea1';

-- ── 6) Aposentar a coluna vazia — SEM apagar ─────────────────────────────
-- Deletar geraria 528 linhas de histórico órfãs. Ela fica no funil de Vendas,
-- vazia e marcada. A deleção, se for feita, fica para depois da estabilização.
UPDATE public.pipeline_stages
   SET name = 'Nutrição Antigos (migrada)'
 WHERE id = '9de8e54e-7edb-47dd-b613-de22276d8ea1';

-- Sem alias, nenhuma regra a resolve como destino — a regra de 60 dias passa a
-- pular limpo em vez de tentar uma travessia que seria recusada.
DELETE FROM public.stage_canonical_aliases
 WHERE stage_id = '9de8e54e-7edb-47dd-b613-de22276d8ea1';

-- ── 7) Declarar as travessias permitidas ─────────────────────────────────
-- Vendas → Pacientes, apenas para as duas colunas de agendamento e apenas pelos
-- gatilhos de conversão. Origem: as colunas de Vendas onde um lead pode
-- legitimamente converter. Ficam de fora Desqualificado e Administrativo.
INSERT INTO public.pipeline_crossings
  (clinic_id, from_stage_id, to_stage_id, trigger_key, allow_auto, note)
SELECT 'cf038458-457d-4c1a-9ac4-c88c3c8353a1', src.id, d.to_stage, d.trigger_key, true, d.note
FROM public.pipeline_stages src
CROSS JOIN (VALUES
  ('e12f004a-6445-4815-8d6b-22f928507a9a'::uuid, 'auto:field-changed-consulta',
   'Conversão: secretária preencheu a data da consulta'),
  ('98320189-6002-4f75-b99d-0b407189efe8'::uuid, 'auto:field-changed-procedimento',
   'Conversão: secretária preencheu a data do tratamento'),
  ('e12f004a-6445-4815-8d6b-22f928507a9a'::uuid, 'auto:appointment-sync',
   'Conversão: compromisso de consulta/retorno marcado como agendado'),
  ('98320189-6002-4f75-b99d-0b407189efe8'::uuid, 'auto:appointment-sync',
   'Conversão: compromisso de procedimento marcado como agendado')
) AS d(to_stage, trigger_key, note)
WHERE src.id IN (
  'b1aa2fc9-d221-4d4f-b53a-7303ec4b75b0',  -- Leads de entrada
  'c6eb67f3-cba9-41e5-949c-aa12d34d962d',  -- Qualificação
  '9f408ae6-649e-44b2-bc56-f93d138c87ed',  -- Sem resposta
  '64356dbe-3889-4b49-9429-260501cdb3d8'   -- Nutrição Inativa
)
ON CONFLICT DO NOTHING;

-- ── 8) Ordem das colunas nos dois funis ──────────────────────────────────
UPDATE public.pipeline_stages SET position = v.pos FROM (VALUES
  ('b1aa2fc9-d221-4d4f-b53a-7303ec4b75b0'::uuid, 0),  -- Leads de entrada
  ('c6eb67f3-cba9-41e5-949c-aa12d34d962d'::uuid, 1),  -- Qualificação
  ('9f408ae6-649e-44b2-bc56-f93d138c87ed'::uuid, 2),  -- Sem resposta
  ('64356dbe-3889-4b49-9429-260501cdb3d8'::uuid, 3),  -- Nutrição Inativa
  ('35670cad-3f95-4e11-8f73-e8b27b865f89'::uuid, 4),  -- Desqualificado
  ('23a7bfd7-2baf-4d0f-8ed1-2b59b719020d'::uuid, 5),  -- Administrativo
  ('9de8e54e-7edb-47dd-b613-de22276d8ea1'::uuid, 9),  -- Nutrição Antigos (migrada)
  ('e12f004a-6445-4815-8d6b-22f928507a9a'::uuid, 0),  -- Consulta Agendada
  ('98320189-6002-4f75-b99d-0b407189efe8'::uuid, 1),  -- Tratamento Agendado
  ('7584241f-6e4b-4824-aaea-e271e865227d'::uuid, 2),  -- Consulta Finalizada
  ('2a352661-01e2-41f8-be10-032f803e2387'::uuid, 3),  -- Tratamento Finalizado
  ('7fea97d7-c2af-4e6f-8f39-af8375bb4468'::uuid, 5)   -- Paciente Inativo
) AS v(id, pos) WHERE public.pipeline_stages.id = v.id;

-- ── 9) Nomear o funil de Vendas ──────────────────────────────────────────
UPDATE public.pipelines
   SET name = 'Clínica ÓR — Vendas'
 WHERE id = '17c27f4d-8256-4ea7-b5b9-ed706494f686';

COMMIT;

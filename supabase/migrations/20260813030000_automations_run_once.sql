-- =====================================================================
-- Etapa 5.2 — `run_once` em automations (Clínica ÓR)
--
-- Quatro automações precisam disparar UMA ÚNICA VEZ na vida do lead:
--   • Follow-up #1 (ao entrar em Sem Resposta)
--   • Follow-up #2 (+48h)
--   • Pesquisa de satisfação — Consulta
--   • Pesquisa de satisfação — Procedimento
--
-- Hoje isso é aproximado por `cooldown_hours = 8760` (1 ano) nas pesquisas.
-- O campo torna a intenção explícita e permanente.
--
-- Semântica em automations-tick:
--   run_once = false  → janela de cooldown, contando success E error
--                       (foi assim que se matou o loop de 813 tentativas)
--   run_once = true   → conta apenas `success`, sem janela de tempo, com teto
--                       de 3 tentativas. Sem o teto, uma única falha de envio
--                       bloquearia o lead para sempre, em silêncio.
--
-- Ver docs/tenants/clinica-or/FLUXO_ALVO.md §6b
-- =====================================================================

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS run_once boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.automations.run_once IS
  'Dispara uma única vez por lead, para sempre. Ignora cooldown_hours; conta '
  'apenas execuções com status success, com teto de 3 tentativas.';

-- As duas pesquisas de satisfação da ÓR passam a ser explicitamente run_once.
-- O cooldown de 8760h vira redundante, mas fica: se run_once for desligado um
-- dia, o comportamento antigo volta em vez de virar spam.
UPDATE public.automations
   SET run_once = true
 WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
   AND name ILIKE '%Pesquisa de Satisfação%';

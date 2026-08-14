-- Instância de WhatsApp por automação
-- ---------------------------------------------------------------------------
-- Sequências já escolhem a instância de envio (`message_sequences.whatsapp_instance_id`,
-- seletor "WhatsApp para envio" na tela de Sequências) e o `sequence-tick` usa isso
-- para preencher a instância do lead quando está vazia. Automação não tinha nada
-- disso: o `evolution-send` lê só `leads.whatsapp_instance_id` e devolve
-- "Nenhuma instância WhatsApp configurada" quando está nulo.
--
-- Foi assim que a `ÓR — Pesquisa de Satisfação (Consulta)` falhou em 14/08 15:10,
-- no mesmo minuto em que um lembrete saiu normalmente para outro lead: o lead da
-- pesquisa não tinha instância, o do lembrete tinha. Na ÓR são 1.488 leads sem
-- vínculo — 774 só em Nutrição Inativa.
--
-- NULL mantém o comportamento atual (usa a instância do lead). Não há default:
-- escolher a instância é decisão de quem opera, feita na tela.

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id uuid
    REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.automations.whatsapp_instance_id IS
  'Instância usada para enviar. NULL = usa a do lead. Quando preenchida, o '
  'automations-tick grava essa instância no lead antes de enviar, mas só se o '
  'lead ainda não tiver uma — nunca sobrescreve vínculo existente.';

-- Desativa todos os agentes da Febracis (clinic_id = 'ab2f4484-886c-48f2-bfc6-0651d062c575')
-- em vez de deletar, para evitar violações de foreign key (ex: ai_chat_traces).
-- Isso garante que eles não rodem mais.
UPDATE public.ai_agents
SET enabled = false
WHERE clinic_id = 'ab2f4484-886c-48f2-bfc6-0651d062c575';

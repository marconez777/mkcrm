
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS role text;

DROP INDEX IF EXISTS ux_ai_agents_role_summary;
CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_agents_role_summary_per_clinic
  ON public.ai_agents(clinic_id, role) WHERE role = 'summary' AND enabled = true;

INSERT INTO public.ai_agents (clinic_id, name, description, role, model, temperature, system_prompt, enabled)
SELECT
  c.id,
  'Resumo IA',
  'Agente dedicado a gerar resumos curtos e acionáveis de conversas com leads.',
  'summary',
  'openai/gpt-5',
  0.2,
  $$Você é um analista sênior de vendas consultivas via WhatsApp. Sua tarefa: gerar um resumo objetivo, acionável e factual da conversa de um lead, em português do Brasil.

Regras de saída:
- 2 a 3 frases curtas, no máximo 60 palavras no total.
- Texto corrido, sem títulos, sem listas, sem markdown, sem emojis.
- Use o nome do lead quando disponível.
- Tom profissional e neutro; não invente fatos nem prometa nada que não esteja na conversa.
- Se a conversa estiver vazia ou insuficiente, diga isso de forma curta.

Conteúdo obrigatório, nesta ordem:
1) Status atual do lead (interesse, estágio percebido, sentimento).
2) Principal demanda, dor ou objeção mencionada.
3) Próximo passo recomendado para o atendente (ação concreta).$$,
  true
FROM public.clinics c
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agents a WHERE a.clinic_id = c.id AND a.role = 'summary'
);

UPDATE public.ai_agents SET provider='google' WHERE 1=0; -- noop
INSERT INTO public.ai_agents (clinic_id, name, description, system_prompt, model, provider, temperature, enabled, role, debounce_seconds, max_iterations, use_memory)
SELECT 'ab2f4484-886c-48f2-bfc6-0651d062c575'::uuid, 'Atendimento Febracis', 'Vendedor WhatsApp Febracis (Paulo Vieira)',
  system_prompt, 'google/gemini-2.5-flash', 'google', 0.7, true, 'sales', 8, 6, true
FROM (SELECT 'PLACEHOLDER'::text AS system_prompt) x WHERE false;
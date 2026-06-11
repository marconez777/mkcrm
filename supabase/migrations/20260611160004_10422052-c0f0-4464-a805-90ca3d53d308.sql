
-- Allow chat traces to survive agent deletion
ALTER TABLE public.ai_chat_traces DROP CONSTRAINT ai_chat_traces_agent_id_fkey;
ALTER TABLE public.ai_chat_traces
  ADD CONSTRAINT ai_chat_traces_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;

-- Disable system-agent delete guard temporarily
ALTER TABLE public.ai_agents DISABLE TRIGGER USER;

UPDATE public.whatsapp_instances
SET watcher_agent_id = NULL, watcher_pipeline_id = NULL
WHERE watcher_agent_id IN (
  SELECT id FROM public.ai_agents
  WHERE system_key = 'classifier' OR name = 'Classificador de Pipeline'
);

DELETE FROM public.pending_replies
WHERE agent_id IN (
  SELECT id FROM public.ai_agents
  WHERE system_key = 'classifier' OR name = 'Classificador de Pipeline'
);

DELETE FROM public.ai_agents
WHERE system_key = 'classifier' OR name = 'Classificador de Pipeline';

ALTER TABLE public.ai_agents ENABLE TRIGGER USER;

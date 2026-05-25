ALTER TABLE public.agent_memory DROP CONSTRAINT IF EXISTS agent_memory_kind_check;
ALTER TABLE public.agent_memory ADD CONSTRAINT agent_memory_kind_check
  CHECK (kind = ANY (ARRAY[
    'summary','fact','preference','objection','doubt','interest',
    'drop_off','behavior','profile','competitor','price_sensitivity','trigger'
  ]));
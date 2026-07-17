CREATE TABLE IF NOT EXISTS public.pipeline_tenant_classifiers (
    clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
    enabled boolean DEFAULT true NOT NULL,
    classifier_version text DEFAULT 'v6-shared' NOT NULL,
    override_prompts jsonb DEFAULT '{}'::jsonb NOT NULL,
    allowed_intents jsonb DEFAULT '[]'::jsonb NOT NULL,
    locked_stages jsonb DEFAULT '[]'::jsonb NOT NULL,
    active_agents jsonb DEFAULT '["summarizer", "agendador", "typifier", "movimentador", "maestro"]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.pipeline_tenant_classifiers ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Authenticated users can read pipeline_tenant_classifiers" 
ON public.pipeline_tenant_classifiers 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert pipeline_tenant_classifiers" 
ON public.pipeline_tenant_classifiers 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update pipeline_tenant_classifiers" 
ON public.pipeline_tenant_classifiers 
FOR UPDATE 
USING (auth.role() = 'authenticated');

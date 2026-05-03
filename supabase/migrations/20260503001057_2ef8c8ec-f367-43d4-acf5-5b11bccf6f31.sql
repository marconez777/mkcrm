
-- Settings (singleton)
CREATE TABLE public.settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  evolution_url TEXT,
  evolution_api_key TEXT,
  evolution_instance TEXT,
  webhook_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);
INSERT INTO public.settings (id) VALUES (1);

-- Attendants
CREATE TABLE public.attendants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipeline stages
CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.pipeline_stages (name, position, color) VALUES
  ('Novo Lead', 0, '#3b82f6'),
  ('Em atendimento', 1, '#f59e0b'),
  ('Qualificado', 2, '#8b5cf6'),
  ('Proposta', 3, '#ec4899'),
  ('Ganho', 4, '#10b981'),
  ('Perdido', 5, '#ef4444');

-- Leads (one per WhatsApp contact)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  company TEXT,
  deal_value NUMERIC(12,2),
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  custom_fields JSONB NOT NULL DEFAULT '{}',
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  attendant_id UUID REFERENCES public.attendants(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leads_stage_idx ON public.leads(stage_id, position);
CREATE INDEX leads_last_msg_idx ON public.leads(last_message_at DESC);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  external_id TEXT,
  from_me BOOLEAN NOT NULL DEFAULT false,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_mime TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  raw JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, external_id)
);
CREATE INDEX messages_lead_ts_idx ON public.messages(lead_id, timestamp);

-- Custom field definitions
CREATE TABLE public.lead_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  options JSONB,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- stage_changed_at trigger
CREATE OR REPLACE FUNCTION public.set_stage_changed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER leads_stage_changed BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_stage_changed_at();

-- Enable RLS (open policies because it's single-user MVP without auth)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_custom_fields ENABLE ROW LEVEL SECURITY;

-- Public access policies (MVP, single-user, no auth)
CREATE POLICY "public_all" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.attendants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.pipeline_stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.lead_custom_fields FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.pipeline_stages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;

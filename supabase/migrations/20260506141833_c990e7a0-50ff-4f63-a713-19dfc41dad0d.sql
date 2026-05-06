
-- =========================================================================
-- MULTI-TENANT FASE 1: Fundação
-- =========================================================================

-- Enums
CREATE TYPE public.clinic_role AS ENUM ('owner', 'admin', 'professional', 'viewer');
CREATE TYPE public.app_role AS ENUM ('super_admin');
CREATE TYPE public.professional_type AS ENUM ('psiquiatra', 'psicologo', 'recepcao', 'admin', 'outro');

-- =========================================================================
-- 1. CORE TENANT TABLES
-- =========================================================================

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  plan text NOT NULL DEFAULT 'free',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  full_name text,
  email text,
  professional_type public.professional_type,
  council_number text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clinic_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,  -- 1 user = 1 clinic
  role public.clinic_role NOT NULL DEFAULT 'professional',
  attendant_id uuid,  -- vínculo opcional com attendants para visibilidade
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_members_clinic ON public.clinic_members(clinic_id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE public.clinic_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.clinic_role NOT NULL DEFAULT 'professional',
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_invites_clinic ON public.clinic_invites(clinic_id);
CREATE INDEX idx_clinic_invites_email ON public.clinic_invites(lower(email));

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid,
  actor_user_id uuid,
  action text NOT NULL,
  entity text,
  entity_id text,
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_clinic ON public.audit_log(clinic_id, created_at DESC);

CREATE TABLE public.data_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid,
  actor_user_id uuid,
  lead_id uuid,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_data_access_log_lead ON public.data_access_log(lead_id, created_at DESC);

-- =========================================================================
-- 2. SECURITY DEFINER FUNCTIONS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT clinic_id FROM public.clinic_members WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_role()
RETURNS public.clinic_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.clinic_members WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.clinic_members
    WHERE user_id = _user_id AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_clinic_access(_clinic_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS(SELECT 1 FROM public.clinic_members WHERE user_id = auth.uid() AND clinic_id = _clinic_id);
$$;

-- =========================================================================
-- 3. SEED INITIAL CLINIC + BACKFILL
-- =========================================================================

DO $$
DECLARE
  v_clinic_id uuid;
  v_first_user uuid;
BEGIN
  -- Cria clínica inicial
  INSERT INTO public.clinics (name, slug) VALUES ('MKart', 'mkart')
  RETURNING id INTO v_clinic_id;

  -- Vincula primeiro usuário existente como owner
  SELECT id INTO v_first_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_first_user IS NOT NULL THEN
    INSERT INTO public.clinic_members (clinic_id, user_id, role)
    VALUES (v_clinic_id, v_first_user, 'owner');
    INSERT INTO public.profiles (user_id, email)
    SELECT v_first_user, email FROM auth.users WHERE id = v_first_user
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Salva id para uso no backfill
  PERFORM set_config('app.seed_clinic_id', v_clinic_id::text, true);
END $$;

-- =========================================================================
-- 4. ADD clinic_id TO ALL DOMAIN TABLES + BACKFILL
-- =========================================================================

-- Helper macro via DO block
DO $$
DECLARE
  v_clinic_id uuid;
  t text;
  domain_tables text[] := ARRAY[
    'whatsapp_instances','pipelines','pipeline_stages','attendants','leads','messages',
    'lead_events','lead_internal_notes','lead_tasks','lead_custom_fields',
    'lead_reply_counters','lead_ai_settings','quick_replies','message_templates',
    'scheduled_messages','pending_replies','ai_agents','ai_documents','ai_chunks',
    'ai_threads','ai_messages','agent_memory','agent_traces','agent_evals',
    'agent_mcp_servers','ai_usage','automations','automation_runs',
    'stage_ai_defaults','task_boards','task_columns','task_labels','tasks',
    'task_assignees','task_attachments','task_checklist_items','task_label_links',
    'webhook_events'
  ];
BEGIN
  SELECT id INTO v_clinic_id FROM public.clinics WHERE slug = 'mkart';

  FOREACH t IN ARRAY domain_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS clinic_id uuid', t);
    EXECUTE format('UPDATE public.%I SET clinic_id = %L WHERE clinic_id IS NULL', t, v_clinic_id);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN clinic_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE',
      t, t || '_clinic_id_fkey');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(clinic_id)', 'idx_' || t || '_clinic', t);
  END LOOP;
END $$;

-- =========================================================================
-- 5. RLS — ENABLE + REPLACE POLICIES
-- =========================================================================

-- Habilita RLS nas novas
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_log ENABLE ROW LEVEL SECURITY;

-- Policies novas
CREATE POLICY clinics_select ON public.clinics FOR SELECT TO authenticated
  USING (public.has_clinic_access(id));
CREATE POLICY clinics_super_admin_all ON public.clinics FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY clinics_admin_update ON public.clinics FOR UPDATE TO authenticated
  USING (id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (id = public.current_clinic_id() AND public.is_clinic_admin());

CREATE POLICY clinic_members_select ON public.clinic_members FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() OR public.is_super_admin());
CREATE POLICY clinic_members_admin_write ON public.clinic_members FOR ALL TO authenticated
  USING (public.is_super_admin() OR (clinic_id = public.current_clinic_id() AND public.is_clinic_admin()))
  WITH CHECK (public.is_super_admin() OR (clinic_id = public.current_clinic_id() AND public.is_clinic_admin()));

CREATE POLICY profiles_self_or_clinic ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS(
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = profiles.user_id AND cm.clinic_id = public.current_clinic_id()
    )
  );
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY profiles_self_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY user_roles_super_admin ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY clinic_invites_admin ON public.clinic_invites FOR ALL TO authenticated
  USING (public.is_super_admin() OR (clinic_id = public.current_clinic_id() AND public.is_clinic_admin()))
  WITH CHECK (public.is_super_admin() OR (clinic_id = public.current_clinic_id() AND public.is_clinic_admin()));

CREATE POLICY audit_log_read ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (clinic_id = public.current_clinic_id() AND public.is_clinic_admin()));

CREATE POLICY data_access_log_read ON public.data_access_log FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (clinic_id = public.current_clinic_id() AND public.is_clinic_admin()));

-- Substitui authenticated_all em todas as tabelas de domínio por clinic-scoped
DO $$
DECLARE
  t text;
  domain_tables text[] := ARRAY[
    'whatsapp_instances','pipelines','pipeline_stages','attendants','leads','messages',
    'lead_events','lead_internal_notes','lead_tasks','lead_custom_fields',
    'lead_reply_counters','lead_ai_settings','quick_replies','message_templates',
    'scheduled_messages','pending_replies','ai_agents','ai_documents','ai_chunks',
    'ai_threads','ai_messages','agent_memory','agent_traces','agent_evals',
    'agent_mcp_servers','ai_usage','automations','automation_runs',
    'stage_ai_defaults','task_boards','task_columns','task_labels','tasks',
    'task_assignees','task_attachments','task_checklist_items','task_label_links',
    'webhook_events'
  ];
BEGIN
  FOREACH t IN ARRAY domain_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_all ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY clinic_scoped ON public.%I FOR ALL TO authenticated
      USING (clinic_id = public.current_clinic_id() OR public.is_super_admin())
      WITH CHECK (clinic_id = public.current_clinic_id() OR public.is_super_admin())
    $f$, t);
  END LOOP;
END $$;

-- settings (singleton legacy) — mantém só super admin
DROP POLICY IF EXISTS authenticated_all ON public.settings;
CREATE POLICY settings_super_admin ON public.settings FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- webhook_dedup, embedding_cache, rag_cache — caches globais, mantém aberto a authenticated
-- (não contêm dados de paciente, são lookups por hash)
-- já têm authenticated_all, deixa como está

-- =========================================================================
-- 6. TRIGGERS
-- =========================================================================

CREATE TRIGGER set_clinics_updated_at BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: ao criar usuário no auth, se houver invite válido aceita automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite public.clinic_invites%ROWTYPE;
BEGIN
  -- Cria profile vazio
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  -- Se tem invite pendente para esse email, vincula à clínica
  SELECT * INTO v_invite FROM public.clinic_invites
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    INSERT INTO public.clinic_members (clinic_id, user_id, role)
    VALUES (v_invite.clinic_id, NEW.id, v_invite.role)
    ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.clinic_invites SET accepted_at = now() WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 7. RPC: aceitar invite manualmente (caso usuário já exista)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.accept_clinic_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite public.clinic_invites%ROWTYPE;
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_invite FROM public.clinic_invites
  WHERE token = _token AND accepted_at IS NULL AND expires_at > now();

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_invite';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF lower(v_user_email) <> lower(v_invite.email) THEN
    RAISE EXCEPTION 'invite_email_mismatch';
  END IF;

  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (v_invite.clinic_id, auth.uid(), v_invite.role)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.clinic_invites SET accepted_at = now() WHERE id = v_invite.id;

  RETURN v_invite.clinic_id;
END $$;

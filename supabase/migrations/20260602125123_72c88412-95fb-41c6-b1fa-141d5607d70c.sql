-- Builder Manual versioning
CREATE TABLE public.builder_manual_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL,
  content text NOT NULL,
  summary text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('seed','manual','revert')),
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX builder_manual_versions_one_active
  ON public.builder_manual_versions (is_active) WHERE is_active;
CREATE UNIQUE INDEX builder_manual_versions_version_uq
  ON public.builder_manual_versions (version);
CREATE INDEX builder_manual_versions_version_desc
  ON public.builder_manual_versions (version DESC);

GRANT SELECT ON public.builder_manual_versions TO authenticated;
GRANT ALL ON public.builder_manual_versions TO service_role;

ALTER TABLE public.builder_manual_versions ENABLE ROW LEVEL SECURITY;

-- Only super admins can read history (it's governance content).
CREATE POLICY "super_admin_read_builder_manual"
  ON public.builder_manual_versions
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Writes only via SECURITY DEFINER RPCs (no direct INSERT/UPDATE policies for authenticated).

-- RPC: publish new version
CREATE OR REPLACE FUNCTION public.publish_builder_manual(_content text, _summary text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_version int;
  _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super admin only';
  END IF;
  IF _content IS NULL OR length(_content) < 50 THEN
    RAISE EXCEPTION 'content too short';
  END IF;
  IF _summary IS NULL OR length(trim(_summary)) < 3 THEN
    RAISE EXCEPTION 'summary required (>=3 chars)';
  END IF;

  -- Lock + deactivate current active
  UPDATE public.builder_manual_versions SET is_active = false WHERE is_active;

  SELECT COALESCE(max(version), 0) + 1 INTO _new_version FROM public.builder_manual_versions;

  INSERT INTO public.builder_manual_versions(version, content, summary, source, published_by, is_active)
  VALUES (_new_version, _content, _summary, 'manual', _uid, true);

  RETURN _new_version;
END;
$$;

-- RPC: revert to a prior version (creates a NEW version with that content)
CREATE OR REPLACE FUNCTION public.revert_builder_manual(_version int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _content text;
  _new_version int;
  _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super admin only';
  END IF;

  SELECT content INTO _content FROM public.builder_manual_versions WHERE version = _version;
  IF _content IS NULL THEN
    RAISE EXCEPTION 'version % not found', _version;
  END IF;

  UPDATE public.builder_manual_versions SET is_active = false WHERE is_active;

  SELECT COALESCE(max(version), 0) + 1 INTO _new_version FROM public.builder_manual_versions;

  INSERT INTO public.builder_manual_versions(version, content, summary, source, published_by, is_active)
  VALUES (_new_version, _content, 'Revertido para v' || _version, 'revert', _uid, true);

  RETURN _new_version;
END;
$$;

-- RPC: read active version (used by edge function via service role)
CREATE OR REPLACE FUNCTION public.get_active_builder_manual()
RETURNS TABLE(version int, content text, published_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT version, content, published_at
  FROM public.builder_manual_versions
  WHERE is_active
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.publish_builder_manual(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_builder_manual(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_builder_manual() TO authenticated, service_role, anon;

-- Seed v1 with current file content
INSERT INTO public.builder_manual_versions(version, content, summary, source, is_active)
VALUES (
  1,
  $md$# Manual de boas práticas do Construtor de Agentes

> Este arquivo é o **cérebro** do Construtor de Agentes (`ai-builder`). Tudo que está aqui é
> concatenado ao system prompt fixo do Builder e governa as decisões dele ao gerar prompts,
> sugerir ferramentas e montar fluxos para os agentes finais.
>
> **NUNCA** copie este conteúdo para `ai_documents` de um agente final — ele não deve responder
> cliente final com "boas práticas de criação de agentes".
>
> Conteúdo será preenchido pelo usuário. Quando preenchido, organize seções com âncoras
> `## tooltip:nome` para que `src/lib/builder-tooltips.ts` possa extrair trechos curtos para
> os tooltips "Por que isso importa?" do wizard.
$md$,
  'Seed inicial (importado do arquivo .md)',
  'seed',
  true
);

-- 1) Função utilitária
CREATE OR REPLACE FUNCTION public.is_pure_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'super_admin')
     AND NOT EXISTS (SELECT 1 FROM public.clinic_members WHERE user_id = _uid);
$$;

-- 2) Trigger: bloquear inserir clinic_members se já for super_admin
CREATE OR REPLACE FUNCTION public.prevent_super_admin_clinic_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Usuário é super_admin de plataforma e não pode ser membro de clínica. Remova o papel super_admin antes.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_clinic_membership ON public.clinic_members;
CREATE TRIGGER trg_prevent_super_admin_clinic_membership
BEFORE INSERT OR UPDATE OF user_id ON public.clinic_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_clinic_membership();

-- 3) Trigger inverso: bloquear virar super_admin se já tem clínica
CREATE OR REPLACE FUNCTION public.prevent_clinic_member_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'super_admin' AND EXISTS (SELECT 1 FROM public.clinic_members WHERE user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Usuário é membro de clínica e não pode ser super_admin de plataforma. Remova-o das clínicas antes.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_clinic_member_super_admin ON public.user_roles;
CREATE TRIGGER trg_prevent_clinic_member_super_admin
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_clinic_member_super_admin();

-- 4) Migrar dados: remove super_admin de contato@mkart.com.br, promove marco_next7@hotmail.com
DELETE FROM public.user_roles
WHERE user_id = 'a4db6c6e-eaf1-4de7-bd2a-6d53fee041bf'
  AND role = 'super_admin';

INSERT INTO public.user_roles (user_id, role)
VALUES ('06c0ecdb-b2a9-4072-8f1b-683701d5d88d', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

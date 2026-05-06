
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite public.clinic_invites%ROWTYPE;
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  -- Super admin automático para contato@mkart.com.br
  IF lower(NEW.email) = 'contato@mkart.com.br' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Aceita invite pendente
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

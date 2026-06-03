CREATE OR REPLACE FUNCTION public.accept_clinic_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.clinic_invites%ROWTYPE;
  v_user_email text;
  v_uid uuid := auth.uid();
  v_already_member boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_invite FROM public.clinic_invites WHERE token = _token;
  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_uid;
  IF lower(v_user_email) <> lower(v_invite.email) THEN
    RAISE EXCEPTION 'invite_email_mismatch';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = v_invite.clinic_id AND user_id = v_uid
  ) INTO v_already_member;

  IF NOT v_already_member AND v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'expired_invite';
  END IF;

  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (v_invite.clinic_id, v_uid, v_invite.role)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.clinic_invites
     SET accepted_at = COALESCE(accepted_at, now())
   WHERE clinic_id = v_invite.clinic_id
     AND lower(email) = lower(v_invite.email)
     AND accepted_at IS NULL;

  RETURN v_invite.clinic_id;
END $$;
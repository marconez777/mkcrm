-- Pin de mensagens
ALTER TABLE public.support_chat_messages
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_note text,
  ADD COLUMN IF NOT EXISTS pinned_resolved boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS support_messages_pinned_idx
  ON public.support_chat_messages (pinned_at DESC) WHERE pinned_at IS NOT NULL;

-- Super admin pode marcar/desmarcar pins (UPDATE)
DROP POLICY IF EXISTS "support_messages_super_admin_update" ON public.support_chat_messages;
CREATE POLICY "support_messages_super_admin_update"
  ON public.support_chat_messages
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Takeover humano em threads
ALTER TABLE public.support_chat_threads
  ADD COLUMN IF NOT EXISTS taken_over_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS taken_over_at timestamptz;
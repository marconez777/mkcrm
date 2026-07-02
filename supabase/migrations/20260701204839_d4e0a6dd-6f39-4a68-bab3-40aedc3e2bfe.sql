ALTER TABLE public.broadcast_message_parts
  ADD COLUMN IF NOT EXISTS preview_mode text NOT NULL DEFAULT 'auto'
  CHECK (preview_mode IN ('auto','text_only','link_preview','video_card'));
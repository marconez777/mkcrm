CREATE UNIQUE INDEX IF NOT EXISTS messages_client_message_id_uidx
  ON public.messages (client_message_id)
  WHERE client_message_id IS NOT NULL;
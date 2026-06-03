ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_threads;
ALTER TABLE public.support_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.support_chat_threads REPLICA IDENTITY FULL;
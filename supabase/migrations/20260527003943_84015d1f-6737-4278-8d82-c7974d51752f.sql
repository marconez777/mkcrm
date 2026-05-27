ALTER TABLE public.campaign_throughput REPLICA IDENTITY FULL;
ALTER TABLE public.email_campaigns REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_throughput;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_campaigns;
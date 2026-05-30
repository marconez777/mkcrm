
REVOKE EXECUTE ON FUNCTION public.engagement_broadcasts_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.engagement_sequences_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.engagement_sequence_steps(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;

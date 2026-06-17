
REVOKE EXECUTE ON FUNCTION public.recompute_lead_appointment_summary(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_appointments_recompute()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_lead_risk_handler()                   FROM PUBLIC, anon, authenticated;

GRANT  EXECUTE ON FUNCTION public.recompute_lead_appointment_summary(uuid) TO service_role;

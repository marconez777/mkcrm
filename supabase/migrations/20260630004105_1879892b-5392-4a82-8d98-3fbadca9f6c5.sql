
INSERT INTO public.clinic_secrets (clinic_id, gemini_api_key, gemini_key_last4, gemini_status, active_ai_provider, created_at, updated_at)
SELECT 'ab2f4484-886c-48f2-bfc6-0651d062c575'::uuid, gemini_api_key, gemini_key_last4, gemini_status, 'gemini', now(), now()
FROM public.clinic_secrets WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
ON CONFLICT (clinic_id) DO UPDATE SET
  gemini_api_key = EXCLUDED.gemini_api_key,
  gemini_key_last4 = EXCLUDED.gemini_key_last4,
  gemini_status = EXCLUDED.gemini_status,
  active_ai_provider = 'gemini',
  updated_at = now();

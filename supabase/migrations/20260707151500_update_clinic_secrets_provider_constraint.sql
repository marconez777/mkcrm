ALTER TABLE "public"."clinic_secrets" DROP CONSTRAINT IF EXISTS "clinic_secrets_active_ai_provider_chk";
ALTER TABLE "public"."clinic_secrets" ADD CONSTRAINT "clinic_secrets_active_ai_provider_chk" CHECK (active_ai_provider IN ('openai', 'gemini', 'lovable'));

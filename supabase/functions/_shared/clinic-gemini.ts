// supabase/functions/_shared/clinic-gemini.ts
//
// Helper para usar a chave Gemini BYOK da clínica (clinic_secrets.gemini_api_key)
// nos agents de pipeline. Espelha clinic-openai.ts.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@^1";

export interface ClinicGemini {
  apiKey: string;
  model: (id: string) => ReturnType<ReturnType<typeof createGoogleGenerativeAI>>;
}

export async function getClinicGemini(
  client: SupabaseClient,
  clinicId: string,
): Promise<ClinicGemini | null> {
  const { data, error } = await client
    .from("clinic_secrets")
    .select("gemini_api_key, gemini_status")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error || !data?.gemini_api_key) return null;
  const apiKey = String(data.gemini_api_key);
  const provider = createGoogleGenerativeAI({ apiKey });
  return { apiKey, model: (id: string) => provider(id) };
}

export async function getClinicGeminiKey(
  client: SupabaseClient,
  clinicId: string,
): Promise<string | null> {
  const g = await getClinicGemini(client, clinicId);
  return g?.apiKey ?? null;
}

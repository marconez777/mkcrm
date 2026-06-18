// supabase/functions/_shared/clinic-openai.ts
//
// Helper para usar a chave OpenAI BYOK da clínica (clinic_secrets.openai_api_key)
// nos agents de pipeline (classifier, summarizer, auditores, evals).
//
// Uso:
//   const ai = await getClinicOpenAI(client, clinicId);
//   if (!ai) return { skipped: "no_openai_key" };
//   const { output } = await generateText({ model: ai.model("gpt-5-mini"), ... });

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@^2";

export interface ClinicOpenAI {
  apiKey: string;
  /** Provider AI SDK pronto pra usar. Ex.: ai.model("gpt-5-mini"). */
  model: ReturnType<typeof createOpenAICompatible>;
}

/** Lê a chave OpenAI da clínica e devolve um provider AI SDK pronto. */
export async function getClinicOpenAI(
  client: SupabaseClient,
  clinicId: string,
): Promise<ClinicOpenAI | null> {
  const { data, error } = await client
    .from("clinic_secrets")
    .select("openai_api_key, openai_status")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error || !data?.openai_api_key) return null;
  const apiKey = String(data.openai_api_key);
  const provider = createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return { apiKey, model: provider };
}

/** Lê só a chave (pra chamadas raw fetch — ex.: /v1/models pra ping). */
export async function getClinicOpenAIKey(
  client: SupabaseClient,
  clinicId: string,
): Promise<string | null> {
  const ai = await getClinicOpenAI(client, clinicId);
  return ai?.apiKey ?? null;
}

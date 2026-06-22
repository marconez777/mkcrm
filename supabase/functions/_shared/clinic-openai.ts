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
import { createOpenAI } from "npm:@ai-sdk/openai@^2";

export interface ClinicOpenAI {
  apiKey: string;
  /** Devolve LanguageModel via Chat Completions API com structured outputs.
   *  Uso: `ai.model("gpt-5-mini")`. */
  model: (id: string) => ReturnType<ReturnType<typeof createOpenAI>["chat"]>;
}

/** Lê a chave OpenAI da clínica e devolve um provider AI SDK pronto.
 *  IMPORTANTE: usa `@ai-sdk/openai` v2 via `provider.chat(id)` (Chat Completions)
 *  em vez de `provider(id)` (Responses API). Apenas a Chat Completions API
 *  com `structuredOutputs: true` (default em strict) emite `response_format:
 *  json_schema`, eliminando os ~10% de erros silenciosos `No object generated`
 *  vistos com `@ai-sdk/openai-compatible`. */
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
  // Sem `compatibility: "strict"`: nossos schemas Zod usam .default() em
  // vários campos, o que vira `optional` no JSON schema. O modo strict do
  // OpenAI json_schema rejeita schemas com properties opcionais, fazendo o
  // SDK cair de volta em `json_object` (texto livre) e gerar
  // `No object generated`. O modo padrão (não-strict) aceita defaults.
  const provider = createOpenAI({ apiKey });

  return { apiKey, model: (id: string) => provider.chat(id) };
}



/** Lê só a chave (pra chamadas raw fetch — ex.: /v1/models pra ping). */
export async function getClinicOpenAIKey(
  client: SupabaseClient,
  clinicId: string,
): Promise<string | null> {
  const ai = await getClinicOpenAI(client, clinicId);
  return ai?.apiKey ?? null;
}

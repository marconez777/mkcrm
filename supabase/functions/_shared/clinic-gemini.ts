// supabase/functions/_shared/clinic-gemini.ts
//
// Helper para usar a chave Gemini BYOK da clínica (clinic_secrets.gemini_api_key)
// nos agents de pipeline. Espelha clinic-openai.ts.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@^3";

export interface ClinicGemini {
  apiKey: string;
  model: (id: string) => ReturnType<ReturnType<typeof createGoogleGenerativeAI>>;
}

function log(payload: Record<string, unknown>) {
  try {
    console.log(JSON.stringify({ tag: "clinic-gemini", ...payload }));
  } catch { /* noop */ }
}

export async function getClinicGemini(
  client: SupabaseClient,
  clinicId: string,
): Promise<ClinicGemini | null> {
  log({ step: "query", clinic_id: clinicId });
  const { data, error } = await client
    .from("clinic_secrets")
    .select("gemini_api_key, gemini_status")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const hasKey = !!data?.gemini_api_key;
  const keyLen = hasKey ? String(data!.gemini_api_key).length : 0;
  log({
    step: "query-result",
    clinic_id: clinicId,
    has_error: !!error,
    error_code: error?.code ?? null,
    error_message: error?.message ?? null,
    row_present: !!data,
    has_key: hasKey,
    key_len: keyLen,
    gemini_status: data?.gemini_status ?? null,
  });

  if (error || !hasKey) {
    log({
      step: "resolved",
      clinic_id: clinicId,
      ok: false,
      reason: error
        ? `query_error:${error.code ?? "unknown"}`
        : !data
        ? "no_clinic_secrets_row"
        : "gemini_api_key_empty",
    });
    return null;
  }

  try {
    const apiKey = String(data!.gemini_api_key);
    const provider = createGoogleGenerativeAI({ apiKey });
    log({ step: "resolved", clinic_id: clinicId, ok: true, key_len: apiKey.length });
    return { apiKey, model: (id: string) => provider(id) };
  } catch (e) {
    log({
      step: "resolved",
      clinic_id: clinicId,
      ok: false,
      reason: "provider_init_failed",
      error: (e as Error)?.message ?? String(e),
    });
    return null;
  }
}

export async function getClinicGeminiKey(
  client: SupabaseClient,
  clinicId: string,
): Promise<string | null> {
  const g = await getClinicGemini(client, clinicId);
  return g?.apiKey ?? null;
}

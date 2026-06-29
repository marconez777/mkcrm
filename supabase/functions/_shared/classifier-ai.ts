// supabase/functions/_shared/classifier-ai.ts
//
// Abstração de provider para os agentes do pipeline (classifier, auditor,
// post-move verifier).
//
// Ordem de resolução:
//   1. opts.forceProvider (se passado) - útil para callers explícitos.
//   2. clinic_secrets.active_ai_provider:
//      - "gemini" → BYOK Gemini (createGoogleGenerativeAI)
//      - "openai" → BYOK OpenAI (createOpenAI)
//   3. fallback: CLASSIFIER_PROVIDER env (default "lovable" → Lovable Gateway).
//
// Retorno comum: `{ model(id), provider }`.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getClinicOpenAI } from "./clinic-openai.ts";
import { getClinicGemini } from "./clinic-gemini.ts";
import { getLovableAi } from "./lovable-ai.ts";

export type ClassifierProvider = "lovable" | "openai" | "google";

export interface ClassifierAi {
  model: (id: string) => any;
  provider: ClassifierProvider;
}

function log(payload: Record<string, unknown>) {
  try {
    console.log(JSON.stringify({ tag: "classifier-ai", ...payload }));
  } catch { /* noop */ }
}

export async function getClassifierAi(
  client: SupabaseClient,
  clinicId: string,
  opts: { forceProvider?: ClassifierProvider } = {},
): Promise<ClassifierAi | null> {
  if (opts.forceProvider) {
    log({ step: "force-provider", clinic_id: clinicId, requested: opts.forceProvider });
    const ai = await resolveProvider(client, clinicId, opts.forceProvider);
    log({
      step: "resolve",
      clinic_id: clinicId,
      requested: opts.forceProvider,
      resolved_provider: ai?.provider ?? null,
      fallback_used: false,
    });
    return ai;
  }

  // Consulta o provedor ativo da clínica.
  let active: ClassifierProvider | null = null;
  let activeRaw: string | null = null;
  let readError: string | null = null;
  try {
    const { data, error } = await client
      .from("clinic_secrets")
      .select("active_ai_provider")
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (error) readError = error.message;
    activeRaw = (data?.active_ai_provider as string | undefined) ?? null;
    const v = activeRaw?.toLowerCase();
    if (v === "gemini") active = "google";
    else if (v === "openai") active = "openai";
  } catch (e) {
    readError = (e as Error)?.message ?? String(e);
  }

  log({
    step: "active-provider",
    clinic_id: clinicId,
    active_raw: activeRaw,
    active_normalized: active,
    read_error: readError,
  });

  if (active) {
    const ai = await resolveProvider(client, clinicId, active);
    if (ai) {
      log({
        step: "resolve",
        clinic_id: clinicId,
        requested: active,
        resolved_provider: ai.provider,
        fallback_used: false,
      });
      return ai;
    }
    log({
      step: "byok-missing",
      clinic_id: clinicId,
      requested: active,
      reason: active === "google" ? "gemini_key_missing" : "openai_key_missing",
    });
    // se BYOK selecionado mas chave ausente, cai no fallback de gateway
  }

  const envDefault = ((Deno.env.get("CLASSIFIER_PROVIDER") || "lovable").toLowerCase()) as ClassifierProvider;
  const ai = await resolveProvider(client, clinicId, envDefault);
  log({
    step: "resolve",
    clinic_id: clinicId,
    requested: envDefault,
    resolved_provider: ai?.provider ?? null,
    fallback_used: !!active, // true se queríamos BYOK e caímos no gateway
  });
  return ai;
}

async function resolveProvider(
  client: SupabaseClient,
  clinicId: string,
  provider: ClassifierProvider,
): Promise<ClassifierAi | null> {
  if (provider === "openai") {
    const ai = await getClinicOpenAI(client, clinicId);
    return ai ? { model: ai.model, provider: "openai" } : null;
  }
  if (provider === "google") {
    const ai = await getClinicGemini(client, clinicId);
    return ai ? { model: ai.model, provider: "google" } : null;
  }
  const ai = getLovableAi();
  return ai ? { model: ai.model, provider: "lovable" } : null;
}

/** Resolve o id de modelo apropriado para o provider ativo. */
export function pickModel(
  provider: ClassifierProvider,
  spec: { openai: string; lovable: string; google?: string },
): string {
  if (provider === "google") return spec.google ?? spec.lovable;
  if (provider === "lovable") return spec.lovable;
  return spec.openai;
}

/** Erros de provider que valem retentar: quota/rate-limit/timeout/rede. */
export function isTransientAgentError(reason: string | null | undefined): boolean {
  if (!reason) return false;
  const r = reason.toLowerCase();
  return (
    r.includes("quota") ||
    r.includes("rate_limit") ||
    r.includes("rate limit") ||
    r.includes(" 429") || r.includes(":429") ||
    r.includes(" 402") || r.includes(":402") ||
    r.includes(" 503") || r.includes(":503") ||
    r.includes(" 504") || r.includes(":504") ||
    r.includes("timeout") || r.includes("timed out") ||
    r.includes("econnreset") || r.includes("network") ||
    r.includes("fetch failed") || r.includes("overloaded") ||
    r.includes("temporarily unavailable") ||
    r.includes("no object generated") ||
    r.includes("schema_retry_failed") ||
    r.includes("did not match schema") ||
    r.includes("output validation")
  );
}

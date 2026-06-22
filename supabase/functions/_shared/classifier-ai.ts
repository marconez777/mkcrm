// supabase/functions/_shared/classifier-ai.ts
//
// Abstração de provider para os agentes do pipeline (classifier, auditor,
// post-move verifier).
//
// CLASSIFIER_PROVIDER controla:
//   "lovable" (default) → Lovable AI Gateway com modelos Gemini.
//                         Custo cobrado em créditos do workspace,
//                         para sozinho ao esgotar (HTTP 402).
//   "openai"            → BYOK por clínica (clinic_secrets.openai_api_key)
//                         — fluxo legado, mantido para rollback rápido.
//
// Retorno comum: `{ model(id) }`, igual ao `getClinicOpenAI()`.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getClinicOpenAI } from "./clinic-openai.ts";
import { getLovableAi } from "./lovable-ai.ts";

export interface ClassifierAi {
  model: (id: string) => any;
  provider: "lovable" | "openai";
}

export async function getClassifierAi(
  client: SupabaseClient,
  clinicId: string,
): Promise<ClassifierAi | null> {
  const provider = (Deno.env.get("CLASSIFIER_PROVIDER") || "lovable").toLowerCase();
  if (provider === "openai") {
    const ai = await getClinicOpenAI(client, clinicId);
    return ai ? { model: ai.model, provider: "openai" } : null;
  }
  const ai = getLovableAi();
  return ai ? { model: ai.model, provider: "lovable" } : null;
}

/** Resolve o id de modelo apropriado para o provider ativo.
 *  Mantém uma única tabela de equivalência OpenAI ↔ Gemini para evitar
 *  espalhar `if (provider==='openai')` por todo o classifier. */
export function pickModel(
  provider: "lovable" | "openai",
  spec: { openai: string; lovable: string },
): string {
  return provider === "lovable" ? spec.lovable : spec.openai;
}

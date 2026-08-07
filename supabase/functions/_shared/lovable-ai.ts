// supabase/functions/_shared/lovable-ai.ts
//
// Provider Lovable AI Gateway (OpenAI-compatible) para uso nos agents
// do pipeline. Substitui `getClinicOpenAI()` em fluxos que migraram de
// BYOK OpenAI para Gemini gerenciado pela Lovable.
//
// Vantagens:
//  - Sem chave por clínica: usa LOVABLE_API_KEY do projeto.
//  - Teto de gasto rígido (créditos do workspace; retorna 402 ao esgotar).
//  - Mesma interface { model(id) } usada pelos agents → swap mínimo.
//
// Modelos suportados (passar como id):
//   google/gemini-2.5-flash       (default geral / Maestro / Typifier / Summarizer)
//   google/gemini-2.5-flash-lite  (Agendador / Movimentador / Verifier)
//   google/gemini-2.5-pro         (fallback de alta confiança, caro)

import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@^1";

export interface LovableAi {
  /** Devolve LanguageModel pronto para `generateText({ model: ai.model("google/gemini-2.5-flash"), ... })`. */
  model: (id: string) => ReturnType<ReturnType<typeof createOpenAICompatible>>;
}

let cached: LovableAi | null = null;

export function getLovableAi(): LovableAi | null {
  if (cached) return cached;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("[lovable-ai] LOVABLE_API_KEY ausente — pipeline não pode chamar Gemini");
    return null;
  }
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
  cached = { model: (id: string) => provider(id) };
  return cached;
}

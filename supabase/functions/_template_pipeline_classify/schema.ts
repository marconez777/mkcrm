// supabase/functions/_template_pipeline_classify/schema.ts
// ============================================================================
// Schema Zod do output do Tipificador. Personalize as intents por tenant.
// ============================================================================

import { z } from "npm:zod@^3";

export const IntentEnum = z.enum([
  "qualificado",
  "quer_agendar",
  "perdeu_interesse",
  "indefinido",
]);
export type Intent = z.infer<typeof IntentEnum>;

export const ClassificationSchema = z.object({
  intent: IntentEnum.describe("O que o lead quer neste momento."),
  confidence: z.number().min(0).max(1).default(0.5),
  tags_suggested: z.array(z.string()).default([]).describe(
    "Tags sugeridas — apenas as que estão na whitelist do tenant serão aplicadas.",
  ),
  reason_summary: z.string().max(280).default("").describe(
    "Explicação curta (≤280 chars) do porquê da intenção.",
  ),
});
export type Classification = z.infer<typeof ClassificationSchema>;

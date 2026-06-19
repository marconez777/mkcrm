// supabase/functions/pipeline-classify/schema.ts
// Schema único e enxuto do agente de classificação v2.
// Evita "too many states" do structured output: tags_remove foi removido
// (computado deterministicamente em apply.ts).

import { z } from "npm:zod@^3";

export type Canon =
  | "Novo"
  | "Qualificação"
  | "Consulta agendada"
  | "Tratamento agendado"
  | "Consulta finalizada"
  | "Em tratamento"
  | "Sem resposta"
  | "Nutrição inativa"
  | "Paciente antigo"
  | "Desqualificado"
  | "B2B / Stakeholders";

export const CANON_NAMES: Canon[] = [
  "Novo",
  "Qualificação",
  "Consulta agendada",
  "Tratamento agendado",
  "Consulta finalizada",
  "Em tratamento",
  "Sem resposta",
  "Nutrição inativa",
  "Paciente antigo",
  "Desqualificado",
  "B2B / Stakeholders",
];

export const INTENT_VALUES = [
  "agendamento",
  "reagendamento",
  "agendamento_retorno",
  "duvida_geral",
  "nf_reembolso",
  "pagamento_alegado",
  "desistencia",
  "interesse_tratamento",
  "judicializacao",
  "renovacao_receita",
  "objecao",
  "outro",
] as const;


export const TREATED_STAGES = new Set<string>([
  "Em tratamento",
  "Consulta finalizada",
  "Paciente antigo",
]);

// Tags que NUNCA podem ser removidas por automação (humano-only).
export const PROTECTED_TAGS = new Set<string>([
  "risco_clinico",
  "b2b",
  "vip",
  "paciente_antigo",
  "precisa_atencao_humana",
  "Lock manual",
  "lock_manual",
]);

export const DATE_FIELD_KEYS = new Set<string>([
  "consulta_agendada_em",
  "procedimento_agendado_em",
]);

// G10: janela de respeito a edições humanas em custom_fields (7 dias)
export const G10_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Schema RELAXADO para structured outputs (gpt-5-mini rejeita enums profundos).
// Strings livres validadas/coercidas em `normalizeClassification` abaixo.
export const ClassificationSchemaV2 = z.object({
  mentioned_dates: z
    .array(
      z.object({
        raw: z.string().max(120),
        anchor_iso: z.string(),
        kind: z.string(),
      }),
    )
    .max(4)
    .default([]),
  mentioned_intents: z.array(z.string()).max(3).default([]),
  stage_suggestion: z.string(),
  intent: z.string().default("outro"),
  confidence: z.number().min(0).max(1),
  is_b2b: z.boolean(),
  tags_suggested: z.array(z.string().max(40)).max(8).default([]),
  custom_fields_patch: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .default({}),
  reasons: z.array(z.string()).min(1).max(5),
});

export type ClassificationRaw = z.infer<typeof ClassificationSchemaV2>;

export type ClassificationV2 = {
  mentioned_dates: Array<{ raw: string; anchor_iso: string; kind: "consulta" | "procedimento" }>;
  mentioned_intents: Array<(typeof INTENT_VALUES)[number]>;
  stage_suggestion: Canon;
  intent: (typeof INTENT_VALUES)[number];
  confidence: number;
  is_b2b: boolean;
  tags_suggested: string[];
  custom_fields_patch: Record<string, string | number | boolean | null>;
  reasons: string[];
};

const CANON_SET = new Set<string>(CANON_NAMES);
const INTENT_SET = new Set<string>(INTENT_VALUES);

export function normalizeClassification(raw: ClassificationRaw): ClassificationV2 {
  const stage: Canon = CANON_SET.has(raw.stage_suggestion)
    ? (raw.stage_suggestion as Canon)
    : "Qualificação";
  const intent = INTENT_SET.has(raw.intent)
    ? (raw.intent as (typeof INTENT_VALUES)[number])
    : "outro";
  const mentioned_intents = (raw.mentioned_intents ?? []).filter((i) =>
    INTENT_SET.has(i),
  ) as Array<(typeof INTENT_VALUES)[number]>;
  const mentioned_dates = (raw.mentioned_dates ?? [])
    .filter((d) => d && typeof d.raw === "string" && d.raw.trim() && typeof d.anchor_iso === "string" && d.anchor_iso.trim())
    .map((d) => ({
      raw: d.raw,
      anchor_iso: d.anchor_iso,
      kind: (d.kind === "procedimento" ? "procedimento" : "consulta") as
        | "consulta"
        | "procedimento",
    }));
  return {
    mentioned_dates,
    mentioned_intents,
    stage_suggestion: stage,
    intent,
    confidence: raw.confidence,
    is_b2b: raw.is_b2b,
    tags_suggested: raw.tags_suggested ?? [],
    custom_fields_patch: raw.custom_fields_patch ?? {},
    reasons: raw.reasons,
  };
}

// ============================================================
// V3 — sub-schemas para o pipeline de 3 agentes
// ============================================================

export const SummarizerOutputSchema = z.object({
  summary: z.string().max(1600),
  mentioned_dates: z
    .array(
      z
        .object({
          raw: z.string().max(120).optional().default(""),
          anchor_iso: z.string().optional().default(""),
          kind: z.string().optional().default("consulta"),
        })
        .passthrough(),
    )
    .max(8)
    .optional()
    .default([]),
});
export type SummarizerOutput = z.infer<typeof SummarizerOutputSchema>;

export const TypifierOutputSchema = z.object({
  tags_suggested: z.array(z.string().max(40)).max(8).default([]),
  custom_fields_patch: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .default({}),
});
export type TypifierOutput = z.infer<typeof TypifierOutputSchema>;

export const MaestroOutputSchema = z.object({
  stage_suggestion: z.string(),
  intent: z.string().default("outro"),
  mentioned_intents: z.array(z.string()).max(3).default([]),
  is_b2b: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).min(1).max(5),
});
export type MaestroOutput = z.infer<typeof MaestroOutputSchema>;

/** Combina as saídas dos 3 agentes V3 em um ClassificationV2 normalizado. */
export function mergeV3Outputs(
  s1: SummarizerOutput,
  s2: TypifierOutput,
  s3: MaestroOutput,
): ClassificationV2 {
  return normalizeClassification({
    mentioned_dates: s1.mentioned_dates,
    mentioned_intents: s3.mentioned_intents,
    stage_suggestion: s3.stage_suggestion,
    intent: s3.intent,
    confidence: s3.confidence,
    is_b2b: s3.is_b2b,
    tags_suggested: s2.tags_suggested,
    custom_fields_patch: s2.custom_fields_patch,
    reasons: s3.reasons,
  });
}


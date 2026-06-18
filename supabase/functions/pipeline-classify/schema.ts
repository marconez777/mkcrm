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
  "B2B / Stakeholders",
];

export const INTENT_VALUES = [
  "agendamento",
  "reagendamento",
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

export const ClassificationSchemaV2 = z.object({
  mentioned_dates: z
    .array(
      z.object({
        raw: z.string().max(120),
        anchor_iso: z.string(),
        kind: z.enum(["consulta", "procedimento"]),
      }),
    )
    .max(4)
    .default([]),
  mentioned_intents: z.array(z.enum(INTENT_VALUES)).max(3).default([]),
  stage_suggestion: z.enum([
    "Novo",
    "Qualificação",
    "Consulta agendada",
    "Tratamento agendado",
    "Consulta finalizada",
    "Em tratamento",
    "Sem resposta",
    "Nutrição inativa",
    "Paciente antigo",
    "B2B / Stakeholders",
  ]),
  intent: z.enum(INTENT_VALUES).default("outro"),
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

export type ClassificationV2 = z.infer<typeof ClassificationSchemaV2>;

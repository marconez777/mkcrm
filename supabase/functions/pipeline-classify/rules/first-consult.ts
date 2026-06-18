// supabase/functions/pipeline-classify/rules/first-consult.ts
// Regra "1ª consulta": só pode estar no lead se for primeira consulta real.
// Evidências contrárias: idade >90d, passou por stages tratados, tag paciente_antigo,
// ou ai_summary cita atendimento anterior.

const TREATED_STAGES = new Set(["Em tratamento", "Consulta finalizada", "Paciente antigo"]);
const SUMMARY_HINTS_AGAINST_FIRST = [
  /já\s+realizou/i,
  /paciente\s+antig/i,
  /retorno/i,
  /tratamento\s+anterior/i,
  /sessão\s+anterior/i,
  /já\s+atend/i,
  /alta\s+(?:médica|do\s+tratamento)/i,
];

export type FirstConsultInput = {
  createdAt: string | null;
  tags: string[];
  hasBeenTreatedBefore: boolean;
  recentStageHistory: Array<{ from: string | null; to: string | null }>;
  aiSummary: string | null;
  nowMs?: number;
};

export type FirstConsultDecision = {
  allowFirstConsultTag: boolean;
  mustRemoveFirstConsultTag: boolean;
  reason: string | null;
};

export function evaluateFirstConsult(input: FirstConsultInput): FirstConsultDecision {
  const now = input.nowMs ?? Date.now();
  const ageMs = input.createdAt ? now - Date.parse(input.createdAt) : 0;
  const olderThan90d =
    Number.isFinite(ageMs) && ageMs > 90 * 86_400_000;

  const stageHit = input.recentStageHistory.some(
    (h) =>
      (h.to && TREATED_STAGES.has(h.to)) ||
      (h.from && TREATED_STAGES.has(h.from)),
  );
  const tagHit = input.tags.includes("paciente_antigo");
  const summaryHit = !!(
    input.aiSummary &&
    SUMMARY_HINTS_AGAINST_FIRST.some((r) => r.test(input.aiSummary!))
  );

  const blocked =
    olderThan90d || stageHit || tagHit || summaryHit || input.hasBeenTreatedBefore;

  const tagPresent = input.tags.includes("1ª consulta");
  const reason = blocked
    ? olderThan90d
      ? "lead_older_than_90d"
      : stageHit
      ? "passed_through_treated_stage"
      : tagHit
      ? "has_tag_paciente_antigo"
      : summaryHit
      ? "ai_summary_hints_previous_treatment"
      : "treated_before"
    : null;

  return {
    allowFirstConsultTag: !blocked,
    mustRemoveFirstConsultTag: blocked && tagPresent,
    reason,
  };
}

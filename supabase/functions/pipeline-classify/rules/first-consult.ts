// supabase/functions/pipeline-classify/rules/first-consult.ts
// Regra "1ª consulta": só pode estar no lead se for primeira consulta real.
// Evidências contrárias: idade >90d, passou por stages tratados, tag paciente_antigo,
// ou ai_summary cita atendimento anterior.

// Havia aqui um segundo TREATED_STAGES, comparado contra o NOME real da coluna e
// já divergente do de schema.ts (faltava "1ª Sessão Finalizada"). Removido em
// 13/08/2026: `input.hasBeenTreatedBefore` cobre o mesmo conceito e resolve por
// alias canônico em context.ts, imune a rename — foi comparação por nome que fez
// a IA rebaixar 5 pacientes em tratamento quando a coluna virou "Tratamento Ativo".
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
  /** Resolvido por alias canônico em context.ts — única fonte sobre "já tratado". */
  hasBeenTreatedBefore: boolean;
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

  const tagHit = input.tags.includes("paciente_antigo");
  const summaryHit = !!(
    input.aiSummary &&
    SUMMARY_HINTS_AGAINST_FIRST.some((r) => r.test(input.aiSummary!))
  );

  const blocked =
    olderThan90d || tagHit || summaryHit || input.hasBeenTreatedBefore;

  const tagPresent = input.tags.includes("1ª consulta");
  const reason = blocked
    ? olderThan90d
      ? "lead_older_than_90d"
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

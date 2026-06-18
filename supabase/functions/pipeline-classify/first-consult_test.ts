// Tests for rules/first-consult.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateFirstConsult } from "./rules/first-consult.ts";

const baseNow = Date.parse("2026-06-18T12:00:00Z");

Deno.test("lead novo (< 90d) sem histórico permite 1ª consulta", () => {
  const r = evaluateFirstConsult({
    createdAt: "2026-06-10T00:00:00Z",
    tags: [],
    hasBeenTreatedBefore: false,
    recentStageHistory: [],
    aiSummary: null,
    nowMs: baseNow,
  });
  assertEquals(r.allowFirstConsultTag, true);
  assertEquals(r.mustRemoveFirstConsultTag, false);
});

Deno.test("lead com tag paciente_antigo bloqueia", () => {
  const r = evaluateFirstConsult({
    createdAt: "2026-06-10T00:00:00Z",
    tags: ["paciente_antigo", "1ª consulta"],
    hasBeenTreatedBefore: false,
    recentStageHistory: [],
    aiSummary: null,
    nowMs: baseNow,
  });
  assertEquals(r.allowFirstConsultTag, false);
  assertEquals(r.mustRemoveFirstConsultTag, true);
  assertEquals(r.reason, "has_tag_paciente_antigo");
});

Deno.test("ai_summary indicando atendimento prévio bloqueia", () => {
  const r = evaluateFirstConsult({
    createdAt: "2026-06-10T00:00:00Z",
    tags: ["1ª consulta"],
    hasBeenTreatedBefore: false,
    recentStageHistory: [],
    aiSummary: "Paciente já realizou sessão de avaliação em maio.",
    nowMs: baseNow,
  });
  assertEquals(r.allowFirstConsultTag, false);
  assertEquals(r.mustRemoveFirstConsultTag, true);
  assertEquals(r.reason, "ai_summary_hints_previous_treatment");
});

Deno.test("histórico em 'Em tratamento' bloqueia", () => {
  const r = evaluateFirstConsult({
    createdAt: "2026-06-10T00:00:00Z",
    tags: [],
    hasBeenTreatedBefore: false,
    recentStageHistory: [{ from: "Qualificação", to: "Em tratamento" }],
    aiSummary: null,
    nowMs: baseNow,
  });
  assertEquals(r.allowFirstConsultTag, false);
  assertEquals(r.reason, "passed_through_treated_stage");
});

Deno.test("lead >90d bloqueia", () => {
  const r = evaluateFirstConsult({
    createdAt: "2025-01-01T00:00:00Z",
    tags: [],
    hasBeenTreatedBefore: false,
    recentStageHistory: [],
    aiSummary: null,
    nowMs: baseNow,
  });
  assertEquals(r.allowFirstConsultTag, false);
  assertEquals(r.reason, "lead_older_than_90d");
});

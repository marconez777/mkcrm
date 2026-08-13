// Tests for rules/first-consult.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateFirstConsult } from "./rules/first-consult.ts";

const baseNow = Date.parse("2026-06-18T12:00:00Z");

Deno.test("lead novo (< 90d) sem histórico permite 1ª consulta", () => {
  const r = evaluateFirstConsult({
    createdAt: "2026-06-10T00:00:00Z",
    tags: [],
    hasBeenTreatedBefore: false,
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
    aiSummary: "Paciente já realizou sessão de avaliação em maio.",
    nowMs: baseNow,
  });
  assertEquals(r.allowFirstConsultTag, false);
  assertEquals(r.mustRemoveFirstConsultTag, true);
  assertEquals(r.reason, "ai_summary_hints_previous_treatment");
});

// Antes este teste passava `recentStageHistory: [{ to: "Em tratamento" }]` e
// dependia de uma comparação por NOME de coluna feita dentro desta regra.
// Essa detecção saiu daqui em 13/08/2026: quem decide "já foi tratado" é o
// `context.ts`, resolvendo por alias canônico — imune a rename. Foi comparação
// por nome que fez a IA rebaixar 5 pacientes quando a coluna virou
// "Tratamento Ativo". A regra agora apenas confia no booleano.
Deno.test("hasBeenTreatedBefore bloqueia", () => {
  const r = evaluateFirstConsult({
    createdAt: "2026-06-10T00:00:00Z",
    tags: [],
    hasBeenTreatedBefore: true,
    aiSummary: null,
    nowMs: baseNow,
  });
  assertEquals(r.allowFirstConsultTag, false);
  assertEquals(r.reason, "treated_before");
});

Deno.test("lead >90d bloqueia", () => {
  const r = evaluateFirstConsult({
    createdAt: "2025-01-01T00:00:00Z",
    tags: [],
    hasBeenTreatedBefore: false,
    aiSummary: null,
    nowMs: baseNow,
  });
  assertEquals(r.allowFirstConsultTag, false);
  assertEquals(r.reason, "lead_older_than_90d");
});

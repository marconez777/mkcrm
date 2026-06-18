// Tests for date-parser.ts — wrapper sobre parseFutureDateInTZ.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveMentionedDates } from "./date-parser.ts";

Deno.test("DD/MM/AAAA — futuro próximo resolve em SP", () => {
  const now = new Date("2026-06-18T12:00:00Z"); // 09:00 BRT
  const out = resolveMentionedDates(
    [{ raw: "24/06/2026", anchor_iso: "2026-06-18T12:00:00Z", kind: "consulta" }],
    now,
  );
  assertEquals(out[0].rejected_reason, null);
  assert(out[0].resolved!.startsWith("2026-06-24"));
});

Deno.test("data muito no futuro (>90d) é rejeitada", () => {
  const now = new Date("2026-06-18T12:00:00Z");
  const out = resolveMentionedDates(
    [{ raw: "31/12/2026", anchor_iso: "2026-06-18T12:00:00Z", kind: "consulta" }],
    now,
  );
  assertEquals(out[0].rejected_reason, "too_far_future");
  assertEquals(out[0].resolved, null);
});

Deno.test("anchor inválido rejeita", () => {
  const out = resolveMentionedDates(
    [{ raw: "amanhã", anchor_iso: "not-a-date", kind: "consulta" }],
    new Date(),
  );
  assertEquals(out[0].rejected_reason, "anchor_invalid");
});

Deno.test("string ambígua/passada rejeita", () => {
  const now = new Date("2026-06-18T12:00:00Z");
  const out = resolveMentionedDates(
    [{ raw: "quinta às 15h", anchor_iso: "2026-06-18T12:00:00Z", kind: "consulta" }],
    now,
  );
  // parseFutureDateInTZ não entende "quinta às 15h" — espera-se rejeição
  assertEquals(out[0].rejected_reason, "ambiguous_or_past");
});

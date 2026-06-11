// Unit tests para o avaliador de regras (puro, sem rede).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evalCondition, getField, matches } from "./index.ts";

Deno.test("getField — chave simples e dot.path", () => {
  const cf = { qualificacao: "interessado", pagamento: { status: "pago" } };
  assertEquals(getField(cf, "qualificacao"), "interessado");
  assertEquals(getField(cf, "pagamento.status"), "pago");
  assertEquals(getField(cf, "inexistente"), undefined);
  assertEquals(getField(cf, "pagamento.nada"), undefined);
});

Deno.test("evalCondition — equals / not_equals", () => {
  const cf = { x: "a" };
  assertEquals(evalCondition(cf, { field: "x", op: "equals", value: "a" }), true);
  assertEquals(evalCondition(cf, { field: "x", op: "equals", value: "b" }), false);
  assertEquals(evalCondition(cf, { field: "x", op: "not_equals", value: "b" }), true);
});

Deno.test("evalCondition — is_true / is_false / is_empty / not_empty", () => {
  assertEquals(evalCondition({ a: true }, { field: "a", op: "is_true" }), true);
  assertEquals(evalCondition({ a: false }, { field: "a", op: "is_false" }), true);
  assertEquals(evalCondition({}, { field: "a", op: "is_empty" }), true);
  assertEquals(evalCondition({ a: "" }, { field: "a", op: "is_empty" }), true);
  assertEquals(evalCondition({ a: [] }, { field: "a", op: "is_empty" }), true);
  assertEquals(evalCondition({ a: "x" }, { field: "a", op: "not_empty" }), true);
});

Deno.test("evalCondition — in / contains", () => {
  assertEquals(
    evalCondition({ p: "pix" }, { field: "p", op: "in", value: ["pix", "boleto"] }),
    true,
  );
  assertEquals(
    evalCondition({ p: "cartao" }, { field: "p", op: "in", value: ["pix", "boleto"] }),
    false,
  );
  assertEquals(
    evalCondition({ t: "Quero fazer EMT" }, { field: "t", op: "contains", value: "emt" }),
    true,
  );
});

Deno.test("evalCondition — gte / lte só funcionam pra número", () => {
  assertEquals(evalCondition({ n: 10 }, { field: "n", op: "gte", value: 5 }), true);
  assertEquals(evalCondition({ n: 4 }, { field: "n", op: "gte", value: 5 }), false);
  assertEquals(evalCondition({ n: 4 }, { field: "n", op: "lte", value: 5 }), true);
  // strings devem retornar false
  assertEquals(evalCondition({ n: "10" }, { field: "n", op: "gte", value: 5 }), false);
});

Deno.test("matches — todas as condições precisam casar (AND)", () => {
  const rule = {
    id: "r1", pipeline_id: "p", target_stage_id: "s", name: "qual+pago", priority: 1,
    enabled: true,
    conditions: [
      { field: "qualificacao", op: "equals" as const, value: "interessado" },
      { field: "tentou_pagamento", op: "is_true" as const },
    ],
  };
  assertEquals(
    matches({ qualificacao: "interessado", tentou_pagamento: true }, rule),
    true,
  );
  assertEquals(
    matches({ qualificacao: "interessado", tentou_pagamento: false }, rule),
    false,
  );
});

Deno.test("matches — regra sem condições nunca casa (proteção)", () => {
  const rule = {
    id: "r1", pipeline_id: "p", target_stage_id: "s", name: "vazia", priority: 1,
    enabled: true, conditions: [],
  };
  assertEquals(matches({ x: 1 }, rule), false);
});

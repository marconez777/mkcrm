import { corsSmoke, postSmoke } from "../_shared/tick_smoke.ts";

Deno.test("field-rules-tick — CORS preflight", async () => {
  await corsSmoke("field-rules-tick");
});

Deno.test("field-rules-tick — POST devolve contrato { ok, results? }", async () => {
  await postSmoke("field-rules-tick", {});
});

import { corsSmoke, postSmoke } from "../_shared/tick_smoke.ts";

Deno.test("vision-tick — CORS preflight", async () => {
  await corsSmoke("vision-tick");
});

Deno.test("vision-tick — POST devolve contrato { ok, results? }", async () => {
  await postSmoke("vision-tick", {});
});

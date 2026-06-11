import { corsSmoke, postSmoke } from "../_shared/tick_smoke.ts";

Deno.test("extractor-tick — CORS preflight", async () => {
  await corsSmoke("extractor-tick");
});

Deno.test("extractor-tick — POST devolve contrato { ok, results? }", async () => {
  await postSmoke("extractor-tick", {});
});

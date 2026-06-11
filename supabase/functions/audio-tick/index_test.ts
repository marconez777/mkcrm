import { corsSmoke, postSmoke } from "../_shared/tick_smoke.ts";

Deno.test("audio-tick — CORS preflight", async () => {
  await corsSmoke("audio-tick");
});

Deno.test("audio-tick — POST devolve contrato { ok, results? }", async () => {
  await postSmoke("audio-tick", {});
});

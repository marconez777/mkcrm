import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { loadNicheKb, nicheKbBlock } from "./niche-loader.ts";

const ALL = [
  "clinic", "dental", "aesthetics", "real_estate", "restaurant",
  "ecommerce", "saas", "law", "education", "agency", "local_services", "other",
] as const;

Deno.test("loads all 12 niche KBs with required sections", async () => {
  for (const slug of ALL) {
    const text = await loadNicheKb(slug);
    assert(text.length > 500, `${slug} too short: ${text.length}`);
    assertStringIncludes(text, "## Vocabulário do nicho", `${slug} missing Vocabulário`);
    assertStringIncludes(text, "## Ofertas típicas", `${slug} missing Ofertas`);
    assertStringIncludes(text, "## Perguntas obrigatórias de qualificação", `${slug} missing Perguntas`);
  }
});

Deno.test("returns empty string for unknown slug", async () => {
  assertEquals(await loadNicheKb("not_a_real_niche"), "");
  assertEquals(await loadNicheKb(""), "");
});

Deno.test("nicheKbBlock formats with label header", async () => {
  const block = await nicheKbBlock("saas", "SaaS / Software B2B");
  assertStringIncludes(block, "--- Conhecimento do nicho: SaaS / Software B2B ---");
  assertStringIncludes(block, "## Vocabulário do nicho");
});

Deno.test("nicheKbBlock returns empty for unknown slug", async () => {
  assertEquals(await nicheKbBlock("bogus", "Bogus"), "");
});

Deno.test("cache hit returns identical content", async () => {
  const a = await loadNicheKb("clinic");
  const b = await loadNicheKb("clinic");
  assertEquals(a, b);
});

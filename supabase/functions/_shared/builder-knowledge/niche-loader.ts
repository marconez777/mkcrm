// Loads niche-specific knowledge bases bundled with the Builder edge function.
// Each KB lives in ./niches/<slug>.md and is injected into the Builder's
// system prompt for actions that take a `niche` (interview_plan,
// generate_system_prompt, draft_knowledge_base, audit_kb, generate_scenarios,
// copilot_chat). Static content — versioned via git, not the DB.

const KNOWN_NICHES = new Set([
  "clinic",
  "dental",
  "aesthetics",
  "real_estate",
  "restaurant",
  "ecommerce",
  "saas",
  "law",
  "education",
  "agency",
  "local_services",
  "other",
]);

const MAX_CHARS = 8_000;
const cache = new Map<string, string>();

export async function loadNicheKb(slug: string): Promise<string> {
  const key = (slug || "").toLowerCase().trim();
  if (!KNOWN_NICHES.has(key)) return "";
  if (cache.has(key)) return cache.get(key)!;
  try {
    const url = new URL(`./niches/${key}.md`, import.meta.url);
    const text = (await Deno.readTextFile(url)).trim().slice(0, MAX_CHARS);
    cache.set(key, text);
    return text;
  } catch (e) {
    console.warn(`[niche-loader] failed to load ${key}:`, e);
    cache.set(key, "");
    return "";
  }
}

export async function nicheKbBlock(slug: string, label: string): Promise<string> {
  const kb = await loadNicheKb(slug);
  if (!kb) return "";
  return `\n\n--- Conhecimento do nicho: ${label} ---\n${kb}\n---\n`;
}

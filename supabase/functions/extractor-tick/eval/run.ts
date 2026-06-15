// Eval runner para o extractor-tick.
// Lê golden/*.json, chama OpenAI com o prompt+schema atual, compara `expected`,
// e imprime accuracy global + violações por invariante.
//
// Uso:
//   deno run --allow-net --allow-env --allow-read \
//     supabase/functions/extractor-tick/eval/run.ts [--model gpt-5-nano]

import { buildSystemPrompt, EXTRACTION_TOOL, normalizeExtracted } from "../index.ts";

interface GoldenCase {
  id: string;
  description: string;
  covers: string[];
  now?: string;
  custom_fields?: Record<string, unknown>;
  messages: Array<{ from_me: boolean; content: string }>;
  expected: Record<string, unknown>;
}

interface CaseResult {
  id: string;
  description: string;
  covers: string[];
  expectedFields: number;
  matched: number;
  mismatches: Array<{ field: string; expected: unknown; got: unknown }>;
  error?: string;
}

function eq(a: unknown, b: unknown): boolean {
  // null e undefined são equivalentes: schema permite omitir o campo
  const aNil = a === null || a === undefined;
  const bNil = b === null || b === undefined;
  if (aNil && bNil) return true;
  if (aNil || bNil) return false;
  if (a === b) return true;
  // datas ISO: comparar só o prefixo AAAA-MM-DD
  if (typeof a === "string" && typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) && /^\d{4}-\d{2}-\d{2}T/.test(b)) {
    return a.slice(0, 10) === b.slice(0, 10);
  }
  return false;
}

async function callOpenAI(apiKey: string, model: string, system: string, user: string) {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "function", function: { name: "extract_lead_fields" } },
  };
  if (!/^(gpt-5|gpt-4\.1|o[134])/i.test(model)) body.temperature = 0.1;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message ?? `HTTP ${r.status}`);
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("no tool call");
  return JSON.parse(args) as Record<string, unknown>;
}

function buildUserPrompt(c: GoldenCase): string {
  const cf = c.custom_fields ?? {};
  const cfLines: string[] = [];
  if (Array.isArray(cf.procedimentos) && (cf.procedimentos as unknown[]).length) {
    cfLines.push(`- Procedimentos já registrados: ${(cf.procedimentos as unknown[]).join(", ")}`);
  }
  if (cf.interesse) cfLines.push(`- Interesse atual: ${cf.interesse}`);
  if (cf.tipo_atendimento) cfLines.push(`- Tipo de atendimento atual: ${cf.tipo_atendimento}`);
  if (cf.qualificacao) cfLines.push(`- Qualificação atual: ${cf.qualificacao}`);
  if (cf.pagamento_confirmado === true) cfLines.push(`- Pagamento já confirmado`);
  const cfBlock = cfLines.length
    ? `Contexto do lead (campos já preenchidos):\n${cfLines.join("\n")}\n\n`
    : "";
  const convo = c.messages.map((m) => `${m.from_me ? "Atendente" : "Lead"}: ${m.content}`).join("\n");
  return `${cfBlock}Conversa (mais antiga em cima, mais recente embaixo):\n\n${convo}\n\nExtraia.`;
}

async function runOne(apiKey: string, model: string, c: GoldenCase): Promise<CaseResult> {
  const now = c.now ? new Date(c.now) : new Date();
  const system = buildSystemPrompt(now);
  const user = buildUserPrompt(c);
  const convo = c.messages.map((m) => `${m.from_me ? "Atendente" : "Lead"}: ${m.content}`).join("\n");

  let extracted: Record<string, unknown> = {};
  let error: string | undefined;
  try {
    extracted = normalizeExtracted(await callOpenAI(apiKey, model, system, user), convo);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const expected = c.expected;
  const mismatches: CaseResult["mismatches"] = [];
  let matched = 0;
  for (const [k, v] of Object.entries(expected)) {
    const got = extracted[k];
    if (eq(v, got)) matched++;
    else mismatches.push({ field: k, expected: v, got });
  }

  return {
    id: c.id,
    description: c.description,
    covers: c.covers,
    expectedFields: Object.keys(expected).length,
    matched,
    mismatches,
    error,
  };
}

async function main() {
  const args = Deno.args;
  const modelIdx = args.indexOf("--model");
  const model = modelIdx >= 0 ? args[modelIdx + 1] : "gpt-5-nano";
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("OPENAI_API_KEY ausente.");
    Deno.exit(2);
  }

  const goldenDir = new URL("./golden/", import.meta.url);
  const cases: GoldenCase[] = [];
  for await (const entry of Deno.readDir(goldenDir)) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;
    const raw = await Deno.readTextFile(new URL(entry.name, goldenDir));
    cases.push(JSON.parse(raw) as GoldenCase);
  }
  cases.sort((a, b) => a.id.localeCompare(b.id));
  console.log(`Eval extractor — ${cases.length} casos · modelo=${model}\n`);

  const results: CaseResult[] = [];
  for (const c of cases) {
    const r = await runOne(apiKey, model, c);
    results.push(r);
    const status = r.error
      ? `ERR ${r.error.slice(0, 60)}`
      : `${r.matched}/${r.expectedFields}`;
    console.log(`  ${r.id.padEnd(40)} ${status.padEnd(12)} [${r.covers.join(",")}]`);
    for (const m of r.mismatches) {
      console.log(`     ↳ ${m.field}: expected=${JSON.stringify(m.expected)} got=${JSON.stringify(m.got)}`);
    }
  }

  const totalExpected = results.reduce((s, r) => s + r.expectedFields, 0);
  const totalMatched = results.reduce((s, r) => s + r.matched, 0);
  const acc = totalExpected ? (totalMatched / totalExpected) * 100 : 0;
  const errors = results.filter((r) => r.error).length;

  console.log(`\nResumo: accuracy=${acc.toFixed(1)}% (${totalMatched}/${totalExpected})  · erros=${errors}/${results.length}`);
  console.log(`Baseline Parte I: 44%  ·  Meta Onda 2: ≥75%  ·  Meta Onda 6: ≥90%`);

  if (acc < 75) Deno.exit(1);
}

if (import.meta.main) {
  await main();
}

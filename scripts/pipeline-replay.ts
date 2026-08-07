/**
 * Replay E2E — Fase 9
 *
 * Reprocessa uma lista fixa de leads-controle invocando o edge
 * `pipeline-run-executor` e mede o resultado. Gera tabela markdown
 * para `dry-run-pr2/AUDIT_REPLAY_FASE9.md`.
 *
 * Requer SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no ambiente.
 *
 * Uso:
 *   bun run scripts/pipeline-replay.ts
 *   bun run scripts/pipeline-replay.ts lead-id-1 lead-id-2 ...
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

// Leads-controle padrão. Substitua/expanda conforme necessário.
const DEFAULT_LEADS = [
  "ba3d7fe0-2d5b-4fe7-b9a0-466632a3d348", // OpenAI quota
  // adicione aqui os outros 9 leads-controle reais antes de rodar
];

const LEADS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_LEADS;
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 120_000;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Result = {
  lead: string;
  status: string;
  provider: string;
  fallback: string;
  latency: number | null;
  attempts: number;
  error: string;
};

async function replayOne(leadId: string): Promise<Result> {
  const before = new Date().toISOString();
  // dispara
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/pipeline-run-executor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE!,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify({ action: "retry_lead", lead_id: leadId, since_hours: 720 }),
  });
  if (!resp.ok) {
    return { lead: leadId, status: "invoke_failed", provider: "-", fallback: "-", latency: null, attempts: 0, error: `http_${resp.status}` };
  }

  // poll novo pipeline_run_items para esse lead após `before`
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const { data } = await sb
      .from("pipeline_run_items")
      .select("status, error, result, auto_retry_count, finished_at")
      .eq("lead_id", leadId)
      .gt("created_at", before)
      .not("finished_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const item = data?.[0];
    if (item) {
      const result = (item.result ?? {}) as { agents?: { provider?: string; latency_ms?: Record<string, number> } };
      const agents = result.agents;
      const latencies = agents?.latency_ms ? Object.values(agents.latency_ms) : [];
      const total = latencies.reduce((s, n) => s + (Number(n) || 0), 0);
      const errStr = item.error ?? "";
      const fallback = /after_fallback_from_/.test(errStr) ? errStr.match(/after_fallback_from_(\w+)/)?.[1] ?? "?" : "no";
      return {
        lead: leadId.slice(0, 8),
        status: item.status as string,
        provider: agents?.provider ?? "-",
        fallback,
        latency: total || null,
        attempts: (item.auto_retry_count as number) ?? 0,
        error: errStr.slice(0, 80),
      };
    }
  }
  return { lead: leadId.slice(0, 8), status: "timeout", provider: "-", fallback: "-", latency: null, attempts: 0, error: "no_finished_item" };
}

async function main() {
  console.log(`Replay E2E — ${LEADS.length} leads`);
  const results: Result[] = [];
  for (const id of LEADS) {
    console.log(`> ${id}`);
    results.push(await replayOne(id));
  }

  // tabela markdown
  console.log("\n| # | Lead | Status | Provider | Fallback | Latency(ms) | retry | Erro |");
  console.log("|---|------|--------|----------|----------|-------------|-------|------|");
  results.forEach((r, i) => {
    console.log(`| ${i + 1} | ${r.lead} | ${r.status} | ${r.provider} | ${r.fallback} | ${r.latency ?? "—"} | ${r.attempts} | ${r.error || "—"} |`);
  });

  const ok = results.filter((r) => r.status === "ok").length;
  const latencies = results.map((r) => r.latency).filter((n): n is number => typeof n === "number").sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const fallbacks = results.filter((r) => r.fallback !== "no" && r.fallback !== "-").length;
  const exhausted = results.filter((r) => r.attempts >= 2).length;

  console.log("\n**Sumário:**");
  console.log(`- Sucesso: ${ok}/${results.length}`);
  console.log(`- p50: ${p50}ms / p95: ${p95}ms`);
  console.log(`- Fallbacks: ${fallbacks}`);
  console.log(`- Esgotados: ${exhausted}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

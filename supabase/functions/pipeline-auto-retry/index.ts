// pipeline-auto-retry: re-enfileira itens com erro transitório (até 2 tentativas).
// Cron: a cada 1 min. Sem JWT (chamado por pg_cron).
//
// Fluxo:
//  1. Lê pipeline_run_items com auto_retry_pending=true E auto_retry_count<2
//     E finished_at < now()-backoff (30s na 1a tentativa, 2min na 2a).
//  2. Agrupa por clinic_id, cria pipeline_runs com scope.lead_ids.
//  3. Incrementa auto_retry_count e limpa auto_retry_pending para evitar duplicado.
//  4. Dispara pipeline-run-executor (continue).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_RETRIES = 2;
const BACKOFF_MS = [30_000, 120_000]; // 30s, 2min
const BATCH = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const now = Date.now();

  try {
    const { data: items, error } = await sb
      .from("pipeline_run_items")
      .select("id, lead_id, clinic_id, auto_retry_count, finished_at")
      .eq("auto_retry_pending", true)
      .lt("auto_retry_count", MAX_RETRIES)
      .not("lead_id", "is", null)
      .order("finished_at", { ascending: true })
      .limit(BATCH);

    if (error) throw new Error(error.message);

    const eligible = (items ?? []).filter((it) => {
      const attempt = (it.auto_retry_count as number) ?? 0;
      const wait = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
      const finished = it.finished_at ? new Date(it.finished_at as string).getTime() : 0;
      return now - finished >= wait;
    });

    if (eligible.length === 0) {
      return jsonResp({ ok: true, processed: 0, eligible: 0 });
    }

    // dedup por lead, agrupa por clinic
    const seen = new Set<string>();
    const byClinic = new Map<string, { leadIds: string[]; itemIds: string[]; attemptByLead: Map<string, number> }>();
    for (const it of eligible) {
      const lid = it.lead_id as string;
      const cid = it.clinic_id as string;
      if (!lid || !cid || seen.has(lid)) continue;
      seen.add(lid);
      const bucket = byClinic.get(cid) ?? { leadIds: [], itemIds: [], attemptByLead: new Map() };
      bucket.leadIds.push(lid);
      bucket.itemIds.push(it.id as string);
      bucket.attemptByLead.set(lid, ((it.auto_retry_count as number) ?? 0) + 1);
      byClinic.set(cid, bucket);
    }

    const runIds: string[] = [];
    let totalLeads = 0;
    let skippedByQuota = 0;

    // Pré-carrega provider_health de cada clinic_id afetado.
    const clinicIds = Array.from(byClinic.keys());
    const { data: healthRows } = await sb
      .from("pipeline_provider_health")
      .select("clinic_id, provider, blocked_until")
      .in("clinic_id", clinicIds);
    const blockedBoth = new Set<string>();
    const byClinicHealth = new Map<string, Set<string>>();
    for (const r of healthRows ?? []) {
      if (new Date(r.blocked_until as string).getTime() <= Date.now()) continue;
      const s = byClinicHealth.get(r.clinic_id as string) ?? new Set();
      s.add(r.provider as string);
      byClinicHealth.set(r.clinic_id as string, s);
    }
    for (const [cid, provs] of byClinicHealth) {
      if (provs.has("lovable") && provs.has("openai")) blockedBoth.add(cid);
    }

    for (const [cid, bucket] of byClinic) {
      if (blockedBoth.has(cid)) {
        // Adia: não consome attempt, apenas mantém auto_retry_pending=true.
        skippedByQuota += bucket.leadIds.length;
        continue;
      }
      // Marca itens primeiro para evitar re-pickup pelo próximo tick.
      for (const itemId of bucket.itemIds) {
        const item = eligible.find((e) => e.id === itemId);
        const nextAttempt = ((item?.auto_retry_count as number) ?? 0) + 1;
        await sb
          .from("pipeline_run_items")
          .update({ auto_retry_pending: false, auto_retry_count: nextAttempt })
          .eq("id", itemId);
      }

      const { data: run, error: insErr } = await sb
        .from("pipeline_runs")
        .insert({
          clinic_id: cid,
          status: "queued",
          scope: { lead_ids: bucket.leadIds, source: "auto_retry" },
        })
        .select("id")
        .single();
      if (insErr) {
        console.error("auto-retry insert failed", cid, insErr.message);
        continue;
      }
      runIds.push(run!.id as string);
      totalLeads += bucket.leadIds.length;

      // Dispara executor sem aguardar
      sb.functions
        .invoke("pipeline-run-executor", { body: { action: "continue", run_id: run!.id } })
        .catch((e) => console.error("invoke executor failed", e));
    }

    return jsonResp({
      ok: true,
      processed: totalLeads,
      eligible: eligible.length,
      runs: runIds.length,
      skipped_by_quota: skippedByQuota,
    });
  } catch (err) {
    console.error("[pipeline-auto-retry] error", err);
    return jsonResp({ ok: false, error: String((err as Error).message ?? err) }, 500);
  }
});

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

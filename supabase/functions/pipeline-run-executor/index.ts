// supabase/functions/pipeline-run-executor/index.ts
//
// Executor manual do pipeline para a Clínica liberada (allowlist).
//
// Ações (POST JSON):
//   { action: "start", clinic_id, pipeline_id?, stage_ids?, lead_ids?, parent_run_id? }
//   { action: "resume", run_id }            → continua run em andamento (auto-encadeado)
//   { action: "status", run_id }            → marca como erro se heartbeat estiver stale
//   { action: "cancel", run_id }
//   { action: "comment", item_id, comment }
//   { action: "retry_commented", run_id }
//   { action: "retry_errors", run_id }
//   { action: "reset_ai_classifications", clinic_id }
//
// Modelo de execução: cada invocação processa no máximo CHUNK_SIZE leads, atualiza
// o heartbeat depois de cada lead, e se ainda houver leads pendentes dispara um
// novo "resume" via fetch (fire-and-forget) e encerra. Assim cada invocação fica
// muito abaixo do limite de 150s da edge runtime, e o run avança até o fim.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CHUNK_SIZE = 2; // máx. leads por invocação
const CLASSIFY_TIMEOUT_MS = 55_000;
const STALE_AFTER_MS = 3 * 60 * 1000; // 3min sem heartbeat = considerado morto

type EdgeRuntimeShape = { waitUntil(p: Promise<unknown>): void } | undefined;

function getEdgeRuntime(): EdgeRuntimeShape {
  return (globalThis as { EdgeRuntime?: EdgeRuntimeShape }).EdgeRuntime;
}

async function getUserFromAuth(req: Request): Promise<{ userId: string } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7);
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await anon.auth.getUser();
  if (!data?.user) return null;
  return { userId: data.user.id };
}

async function assertClinicAdmin(
  service: SupabaseClient,
  userId: string,
  clinicId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: rolesRow } = await service.from("user_roles").select("role").eq("user_id", userId);
  const isSuper = (rolesRow ?? []).some((r) => r.role === "super_admin");
  if (isSuper) return { ok: true };
  const { data: member } = await service
    .from("clinic_members")
    .select("role")
    .eq("user_id", userId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!member) return { ok: false, reason: "not_a_member" };
  if (member.role !== "owner" && member.role !== "admin") return { ok: false, reason: "not_admin" };
  return { ok: true };
}

async function assertAllowlisted(service: SupabaseClient, clinicId: string): Promise<boolean> {
  const { data } = await service
    .from("pipeline_automation_allowlist")
    .select("enabled")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  return !!data?.enabled;
}

interface StartInput {
  clinic_id: string;
  pipeline_id?: string;
  stage_ids?: string[];
  lead_ids?: string[];
  top_n?: number;
  only_agent?: "summarizer" | "typifier" | "maestro";
  parent_run_id?: string;
}

async function callClassify(
  leadId: string,
  onlyAgent?: "summarizer" | "typifier" | "maestro",
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  let timeoutId: number | undefined;
  try {
    const ctrl = new AbortController();
    // Execuções disparadas pelo executor (botões "Executar pipeline inteiro" /
    // "Executar com escopo" / "Reprocessar") são atos manuais → sempre força,
    // ignorando o watermark de no_new_messages.
    const body: Record<string, unknown> = { action: "lead", lead_id: leadId, force: true };
    if (onlyAgent) body.only_agent = onlyAgent;
    const request = fetch(`${SUPABASE_URL}/functions/v1/pipeline-classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const timeout = new Promise<Response>((_, reject) => {
      timeoutId = setTimeout(() => {
        ctrl.abort();
        reject(new Error(`classify_timeout_${Math.round(CLASSIFY_TIMEOUT_MS / 1000)}s`));
      }, CLASSIFY_TIMEOUT_MS);
    });
    const res = await Promise.race([request, timeout]);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      return { ok: false, error: json?.error ?? `http_${res.status}` };
    }
    return { ok: true, result: json?.result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function mergeErrorReason(totals: unknown, reason: string): Record<string, unknown> {
  const base = totals && typeof totals === "object" && !Array.isArray(totals) ? totals as Record<string, unknown> : {};
  return { ...base, error_reason: reason };
}

async function markStaleRunsAsError(service: SupabaseClient, runId?: string): Promise<number> {
  let query = service
    .from("pipeline_runs")
    .select("id, status, started_at, last_heartbeat_at, totals")
    .in("status", ["queued", "running"]);
  if (runId) query = query.eq("id", runId);

  const { data: runs, error } = await query;
  if (error) {
    console.error("[executor] stale watchdog fetch failed", error);
    return 0;
  }

  const now = Date.now();
  let updated = 0;
  for (const run of runs ?? []) {
    const reference = (run.last_heartbeat_at ?? run.started_at) as string | null;
    if (!reference || now - new Date(reference).getTime() <= STALE_AFTER_MS) continue;

    const finishedAt = new Date().toISOString();
    const { error: runErr } = await service
      .from("pipeline_runs")
      .update({
        status: "error",
        finished_at: finishedAt,
        totals: mergeErrorReason(run.totals, "worker_timeout_no_heartbeat"),
      })
      .eq("id", run.id as string)
      .in("status", ["queued", "running"]);
    if (runErr) {
      console.error("[executor] stale watchdog update failed", run.id, runErr);
      continue;
    }
    await service
      .from("pipeline_run_items")
      .update({ status: "error", error: "worker_timeout_no_heartbeat", finished_at: finishedAt })
      .eq("run_id", run.id as string)
      .eq("status", "pending");
    updated += 1;
  }
  return updated;
}

function triggerResume(runId: string): void {
  // fire-and-forget — não esperamos a resposta
  fetch(`${SUPABASE_URL}/functions/v1/pipeline-run-executor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ action: "resume", run_id: runId }),
  }).catch((err) => console.error("[executor] triggerResume failed", err));
}

interface StageRow { id: string; name: string; position: number; pipeline_id: string }

async function loadStages(service: SupabaseClient, runId: string): Promise<StageRow[] | null> {
  const { data: run } = await service.from("pipeline_runs").select("*").eq("id", runId).single();
  if (!run) return null;
  const scope = (run.scope ?? {}) as Record<string, unknown>;
  let q = service
    .from("pipeline_stages")
    .select("id, name, position, pipeline_id")
    .eq("clinic_id", run.clinic_id as string)
    .order("position", { ascending: true });
  if (scope.pipeline_id) q = q.eq("pipeline_id", scope.pipeline_id as string);
  if (Array.isArray(scope.stage_ids) && (scope.stage_ids as string[]).length > 0) {
    q = q.in("id", scope.stage_ids as string[]);
  }
  const { data, error } = await q;
  if (error || !data) return null;
  return data as StageRow[];
}

/**
 * Processa até CHUNK_SIZE leads. Retorna true se ainda há leads pendentes
 * (precisa chamar resume), false se o run terminou.
 */
async function executeChunk(service: SupabaseClient, runId: string): Promise<{ moreWork: boolean; processed: number }> {
  const { data: run } = await service.from("pipeline_runs").select("*").eq("id", runId).single();
  if (!run) return { moreWork: false, processed: 0 };
  if (run.status === "cancelled" || run.status === "done" || run.status === "error") {
    return { moreWork: false, processed: 0 };
  }

  const clinicId = run.clinic_id as string;
  const scope = (run.scope ?? {}) as Record<string, unknown>;
  const explicitLeadIds = Array.isArray(scope.lead_ids) ? (scope.lead_ids as string[]) : null;
  const topNRaw = typeof scope.top_n === "number" ? (scope.top_n as number) : null;
  const topN = topNRaw && topNRaw > 0 ? Math.floor(topNRaw) : null;
  const onlyAgent =
    typeof scope.only_agent === "string" &&
    ["summarizer", "typifier", "maestro"].includes(scope.only_agent as string)
      ? (scope.only_agent as "summarizer" | "typifier" | "maestro")
      : undefined;
  const stepName = onlyAgent ? `classify:${onlyAgent}` : "classify";
  const totals = (run.totals ?? {}) as Record<string, number> & {
    ok?: number; skipped?: number; error?: number; leads?: number; stages?: number;
  };
  totals.ok ??= 0; totals.skipped ??= 0; totals.error ??= 0; totals.leads ??= 0;

  // garante started_at / status running
  if (run.status !== "running") {
    await service
      .from("pipeline_runs")
      .update({
        status: "running",
        started_at: run.started_at ?? new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }

  const stages = await loadStages(service, runId);
  if (!stages) {
    await service
      .from("pipeline_runs")
      .update({ status: "error", finished_at: new Date().toISOString(), totals: { ...totals, error_reason: "no_stages" } })
      .eq("id", runId);
    return { moreWork: false, processed: 0 };
  }
  totals.stages = stages.length;

  // já processados neste run (lead_id por stage_id)
  const { data: doneItems } = await service
    .from("pipeline_run_items")
    .select("lead_id, stage_id, status")
    .eq("run_id", runId);
  const doneSet = new Set<string>();
  for (const it of doneItems ?? []) {
    if (it.status === "pending") continue; // pendente conta como não-feito (será retomado)
    if (it.lead_id && it.stage_id) doneSet.add(`${it.stage_id}::${it.lead_id}`);
  }

  let processed = 0;

  for (const stage of stages) {
    if (processed >= CHUNK_SIZE) return { moreWork: true, processed };

    // checa cancelamento periodicamente
    const { data: cur } = await service.from("pipeline_runs").select("status").eq("id", runId).single();
    if (cur?.status === "cancelled") {
      await service.from("pipeline_runs").update({ finished_at: new Date().toISOString(), totals }).eq("id", runId);
      return { moreWork: false, processed };
    }

    // busca leads desta stage (paginado em lotes grandes; o limite real é CHUNK_SIZE no loop)
    let offset = 0;
    const PAGE = 200;
    while (processed < CHUNK_SIZE) {
      if (topN !== null && totals.leads >= topN) {
        return { moreWork: false, processed };
      }
      let leadsQuery = service
        .from("leads")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("stage_id", stage.id)
        .is("archived_at", null)
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (explicitLeadIds && explicitLeadIds.length > 0) {
        leadsQuery = leadsQuery.in("id", explicitLeadIds);
      }
      const { data: leads, error: leadsErr } = await leadsQuery;
      if (leadsErr) { console.error("[executor] leads fetch failed", leadsErr); break; }
      if (!leads || leads.length === 0) break;

      for (const lead of leads) {
        const key = `${stage.id}::${lead.id}`;
        if (doneSet.has(key)) continue;
        if (processed >= CHUNK_SIZE) return { moreWork: true, processed };
        if (topN !== null && totals.leads >= topN) return { moreWork: false, processed };

        totals.leads += 1;
        processed += 1;

        const itemStart = new Date().toISOString();
        const { data: item } = await service
          .from("pipeline_run_items")
          .insert({
            run_id: runId,
            clinic_id: clinicId,
            lead_id: lead.id,
            stage_id: stage.id,
            stage_name: stage.name,
            step: stepName,
            status: "pending",
            started_at: itemStart,
          })
          .select("id")
          .single();
        const itemId = item?.id as string | undefined;

        // heartbeat ANTES de chamar a IA, para que o watchdog veja vida
        await service
          .from("pipeline_runs")
          .update({ last_heartbeat_at: new Date().toISOString(), totals })
          .eq("id", runId);

        const result = await callClassify(lead.id as string, onlyAgent);
        const finishedAt = new Date().toISOString();

        let status: "ok" | "skipped" | "error" = "ok";
        if (!result.ok) status = "error";
        else if (result.result && typeof result.result === "object" && "skipped" in (result.result as Record<string, unknown>)) {
          status = "skipped";
        }
        totals[status] = (totals[status] ?? 0) + 1;

        if (itemId) {
          await service
            .from("pipeline_run_items")
            .update({
              status,
              result: result.ok ? (result.result as Record<string, unknown>) ?? {} : null,
              error: result.error ?? null,
              finished_at: finishedAt,
            })
            .eq("id", itemId);
        }

        // heartbeat por lead
        await service
          .from("pipeline_runs")
          .update({ last_heartbeat_at: new Date().toISOString(), totals })
          .eq("id", runId);
      }

      if (explicitLeadIds) break;
      if (leads.length < PAGE) break;
      offset += PAGE;
    }
  }

  // Se chegamos até aqui sem atingir o chunk, terminou tudo.
  await service
    .from("pipeline_runs")
    .update({ status: "done", finished_at: new Date().toISOString(), totals })
    .eq("id", runId);
  return { moreWork: false, processed };
}

async function runWorker(service: SupabaseClient, runId: string) {
  try {
    const { moreWork } = await executeChunk(service, runId);
    if (moreWork) triggerResume(runId);
  } catch (err) {
    console.error("[executor] worker crashed", err);
    await service
      .from("pipeline_runs")
      .update({ status: "error", finished_at: new Date().toISOString(), totals: { error: String(err) } })
      .eq("id", runId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const action: string = body.action;
    console.log("[executor v2] action=", action);
    const service = createClient(SUPABASE_URL, SERVICE_KEY);

    if (action === "start") {
      const input = body as StartInput;
      const auth = await getUserFromAuth(req);
      if (!auth) return jsonResp({ error: "unauthorized" }, 401);
      const can = await assertClinicAdmin(service, auth.userId, input.clinic_id);
      if (!can.ok) return jsonResp({ error: can.reason }, 403);
      if (!(await assertAllowlisted(service, input.clinic_id))) {
        return jsonResp({ error: "clinic_not_allowlisted" }, 403);
      }

      // Antes de criar um novo, garante que runs stale sejam fechados
      await markStaleRunsAsError(service);

      const scope: Record<string, unknown> = {};
      if (input.pipeline_id) scope.pipeline_id = input.pipeline_id;
      if (input.stage_ids?.length) scope.stage_ids = input.stage_ids;
      if (input.lead_ids?.length) scope.lead_ids = input.lead_ids;
      if (typeof input.top_n === "number" && input.top_n > 0) scope.top_n = Math.floor(input.top_n);
      if (input.only_agent && ["summarizer", "typifier", "maestro"].includes(input.only_agent)) {
        scope.only_agent = input.only_agent;
      }

      const { data: run, error } = await service
        .from("pipeline_runs")
        .insert({
          clinic_id: input.clinic_id,
          pipeline_id: input.pipeline_id ?? null,
          status: "queued",
          requested_by: auth.userId,
          parent_run_id: input.parent_run_id ?? null,
          scope,
        })
        .select("id")
        .single();
      if (error) return jsonResp({ error: error.message }, error.message.includes("uniq_pipeline_runs_active") ? 409 : 500);

      const runId = run!.id as string;
      const rt = getEdgeRuntime();
      const p = runWorker(service, runId);
      if (rt?.waitUntil) rt.waitUntil(p); else p;
      return jsonResp({ ok: true, run_id: runId });
    }

    if (action === "resume") {
      // sem auth do usuário: só roda se run existir e estiver running/queued
      const runId = body.run_id as string;
      if (!runId) return jsonResp({ error: "run_id_required" }, 400);
      const { data: run } = await service.from("pipeline_runs").select("status").eq("id", runId).single();
      if (!run) return jsonResp({ error: "not_found" }, 404);
      if (run.status !== "running" && run.status !== "queued") {
        return jsonResp({ ok: true, skipped: true, status: run.status });
      }
      const rt = getEdgeRuntime();
      const p = runWorker(service, runId);
      if (rt?.waitUntil) rt.waitUntil(p); else p;
      return jsonResp({ ok: true, run_id: runId });
    }

    if (action === "status") {
      // Watchdog: se heartbeat estiver stale, marca como erro antes de responder.
      await markStaleRunsAsError(service, body.run_id as string | undefined);
      const { data } = await service.from("pipeline_runs").select("*").eq("id", body.run_id).single();
      return jsonResp({ ok: true, run: data });
    }

    if (action === "cancel") {
      const auth = await getUserFromAuth(req);
      if (!auth) return jsonResp({ error: "unauthorized" }, 401);
      const { data: run } = await service.from("pipeline_runs").select("clinic_id, status").eq("id", body.run_id).single();
      if (!run) return jsonResp({ error: "not_found" }, 404);
      const can = await assertClinicAdmin(service, auth.userId, run.clinic_id as string);
      if (!can.ok) return jsonResp({ error: can.reason }, 403);
      if (run.status === "done" || run.status === "error" || run.status === "cancelled") {
        return jsonResp({ ok: true, already_finalized: true });
      }
      await service.from("pipeline_runs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", body.run_id);
      return jsonResp({ ok: true });
    }

    if (action === "comment") {
      const auth = await getUserFromAuth(req);
      if (!auth) return jsonResp({ error: "unauthorized" }, 401);
      const { data: item } = await service.from("pipeline_run_items").select("clinic_id").eq("id", body.item_id).single();
      if (!item) return jsonResp({ error: "not_found" }, 404);
      const can = await assertClinicAdmin(service, auth.userId, item.clinic_id as string);
      if (!can.ok) return jsonResp({ error: can.reason }, 403);
      await service
        .from("pipeline_run_items")
        .update({ comment: body.comment ?? null, retry_requested: !!body.retry_requested })
        .eq("id", body.item_id);
      return jsonResp({ ok: true });
    }

    if (action === "retry_commented" || action === "retry_errors") {
      const auth = await getUserFromAuth(req);
      if (!auth) return jsonResp({ error: "unauthorized" }, 401);
      const { data: parent } = await service.from("pipeline_runs").select("clinic_id, pipeline_id").eq("id", body.run_id).single();
      if (!parent) return jsonResp({ error: "not_found" }, 404);
      const can = await assertClinicAdmin(service, auth.userId, parent.clinic_id as string);
      if (!can.ok) return jsonResp({ error: can.reason }, 403);

      await markStaleRunsAsError(service);

      let itemsQ = service.from("pipeline_run_items").select("lead_id").eq("run_id", body.run_id).not("lead_id", "is", null);
      itemsQ = action === "retry_errors" ? itemsQ.eq("status", "error") : itemsQ.eq("retry_requested", true);
      const { data: items } = await itemsQ;
      const leadIds = Array.from(new Set((items ?? []).map((i) => i.lead_id as string)));
      if (leadIds.length === 0) return jsonResp({ error: "no_leads_to_retry" }, 400);

      const { data: run, error } = await service
        .from("pipeline_runs")
        .insert({
          clinic_id: parent.clinic_id,
          pipeline_id: parent.pipeline_id ?? null,
          status: "queued",
          requested_by: auth.userId,
          parent_run_id: body.run_id,
          scope: { lead_ids: leadIds, source: action },
        })
        .select("id")
        .single();
      if (error) return jsonResp({ error: error.message }, error.message.includes("uniq_pipeline_runs_active") ? 409 : 500);

      const runId = run!.id as string;
      const rt = getEdgeRuntime();
      const p = runWorker(service, runId);
      if (rt?.waitUntil) rt.waitUntil(p); else p;
      return jsonResp({ ok: true, run_id: runId, lead_count: leadIds.length });
    }

    if (action === "reset_ai_classifications") {
      const auth = await getUserFromAuth(req);
      if (!auth) return jsonResp({ error: "unauthorized" }, 401);
      const clinicId = body.clinic_id as string | undefined;
      if (!clinicId) return jsonResp({ error: "clinic_id_required" }, 400);
      const can = await assertClinicAdmin(service, auth.userId, clinicId);
      if (!can.ok) return jsonResp({ error: can.reason }, 403);
      if (!(await assertAllowlisted(service, clinicId))) {
        return jsonResp({ error: "clinic_not_allowlisted" }, 403);
      }
      const { data, error } = await service.rpc("reset_ai_classifications", { p_clinic_id: clinicId });
      if (error) return jsonResp({ error: error.message }, 500);
      return jsonResp({ ok: true, leads_reset: data ?? 0 });
    }

    return jsonResp({ error: "unknown_action" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("pipeline-run-executor error", msg);
    return jsonResp({ ok: false, error: msg }, 500);
  }
});

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
// build-tag: v3 chunked executor + direct stale watchdog

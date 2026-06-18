// supabase/functions/pipeline-run-executor/index.ts
//
// Executor manual do pipeline para a Clínica liberada (allowlist).
//
// Ações (POST JSON):
//   { action: "start", clinic_id, pipeline_id?, stage_ids?, lead_ids?, parent_run_id? }
//   { action: "status", run_id }
//   { action: "cancel", run_id }
//   { action: "comment", item_id, comment }
//   { action: "retry_commented", run_id }   → cria run filha com leads marcados retry_requested
//   { action: "retry_errors", run_id }      → cria run filha com leads que falharam
//
// Worker em background (EdgeRuntime.waitUntil): para cada stage (ordem), para
// cada lead, chama pipeline-classify (que cascateia summarize + tasks + fase4
// + B2B move). Cada execução gera 1 linha em pipeline_run_items.
//
// Autorização: JWT do usuário precisa ser admin/owner da clínica (ou super admin)
// e a clínica precisa estar na pipeline_automation_allowlist.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const STAGE_BATCH = 50;

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
  parent_run_id?: string;
}

async function callClassify(leadId: string): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/pipeline-classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ action: "lead", lead_id: leadId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      return { ok: false, error: json?.error ?? `http_${res.status}` };
    }
    return { ok: true, result: json?.result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function executeRun(service: SupabaseClient, runId: string) {
  const { data: run } = await service.from("pipeline_runs").select("*").eq("id", runId).single();
  if (!run) return;
  const scope = (run.scope ?? {}) as Record<string, unknown>;
  const clinicId = run.clinic_id as string;

  await service
    .from("pipeline_runs")
    .update({ status: "running", started_at: new Date().toISOString(), last_heartbeat_at: new Date().toISOString() })
    .eq("id", runId);

  // 1) Resolve list of stages (ordered).
  let stagesQuery = service
    .from("pipeline_stages")
    .select("id, name, position, pipeline_id")
    .eq("clinic_id", clinicId)
    .order("position", { ascending: true });
  if (scope.pipeline_id) stagesQuery = stagesQuery.eq("pipeline_id", scope.pipeline_id as string);
  if (Array.isArray(scope.stage_ids) && (scope.stage_ids as string[]).length > 0) {
    stagesQuery = stagesQuery.in("id", scope.stage_ids as string[]);
  }
  const { data: stages, error: stagesErr } = await stagesQuery;
  if (stagesErr || !stages) {
    await service
      .from("pipeline_runs")
      .update({ status: "error", finished_at: new Date().toISOString(), totals: { error: stagesErr?.message ?? "no_stages" } })
      .eq("id", runId);
    return;
  }

  const totals = { stages: stages.length, leads: 0, ok: 0, skipped: 0, error: 0 };
  const explicitLeadIds = Array.isArray(scope.lead_ids) ? (scope.lead_ids as string[]) : null;

  for (const stage of stages) {
    // Cancellation check.
    const { data: cur } = await service.from("pipeline_runs").select("status").eq("id", runId).single();
    if (cur?.status === "cancelled") {
      await service.from("pipeline_runs").update({ finished_at: new Date().toISOString(), totals }).eq("id", runId);
      return;
    }

    // Fetch leads in this stage, paginated.
    let offset = 0;
    while (true) {
      let leadsQuery = service
        .from("leads")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("stage_id", stage.id as string)
        .order("created_at", { ascending: true })
        .range(offset, offset + STAGE_BATCH - 1);
      if (explicitLeadIds && explicitLeadIds.length > 0) {
        leadsQuery = leadsQuery.in("id", explicitLeadIds);
      }
      const { data: leads, error: leadsErr } = await leadsQuery;
      if (leadsErr) {
        console.error("[executor] leads fetch failed", leadsErr);
        break;
      }
      if (!leads || leads.length === 0) break;

      for (const lead of leads) {
        totals.leads += 1;
        const itemStart = new Date().toISOString();
        const { data: item } = await service
          .from("pipeline_run_items")
          .insert({
            run_id: runId,
            clinic_id: clinicId,
            lead_id: lead.id as string,
            stage_id: stage.id as string,
            stage_name: stage.name as string,
            step: "classify",
            status: "pending",
            started_at: itemStart,
          })
          .select("id")
          .single();
        const itemId = item?.id as string | undefined;

        const result = await callClassify(lead.id as string);
        const finishedAt = new Date().toISOString();

        let status: "ok" | "skipped" | "error" = "ok";
        if (!result.ok) status = "error";
        else if (result.result && typeof result.result === "object" && "skipped" in (result.result as Record<string, unknown>)) {
          status = "skipped";
        }
        totals[status] += 1;

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
      }

      // Heartbeat + partial totals.
      await service
        .from("pipeline_runs")
        .update({ last_heartbeat_at: new Date().toISOString(), totals })
        .eq("id", runId);

      if (explicitLeadIds) break; // already fully fetched
      if (leads.length < STAGE_BATCH) break;
      offset += STAGE_BATCH;
    }
  }

  await service
    .from("pipeline_runs")
    .update({ status: "done", finished_at: new Date().toISOString(), totals })
    .eq("id", runId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const action: string = body.action;
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

      // If a parent_run_id is provided, copy its leads filtered by retry_requested OR error.
      const scope: Record<string, unknown> = {};
      if (input.pipeline_id) scope.pipeline_id = input.pipeline_id;
      if (input.stage_ids?.length) scope.stage_ids = input.stage_ids;
      if (input.lead_ids?.length) scope.lead_ids = input.lead_ids;

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
      const promise = executeRun(service, runId).catch((err) => {
        console.error("[executor] worker crashed", err);
        return service
          .from("pipeline_runs")
          .update({ status: "error", finished_at: new Date().toISOString(), totals: { error: String(err) } })
          .eq("id", runId);
      });
      const rt = getEdgeRuntime();
      if (rt?.waitUntil) rt.waitUntil(promise);
      else promise; // fire-and-forget
      return jsonResp({ ok: true, run_id: runId });
    }

    if (action === "status") {
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
      const promise = executeRun(service, runId).catch((err) => {
        console.error("[executor] retry worker crashed", err);
      });
      const rt = getEdgeRuntime();
      if (rt?.waitUntil) rt.waitUntil(promise);
      else promise;
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

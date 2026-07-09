// supabase/functions/pipeline-classify-febracis/index.ts

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { isAiAllowedForPipeline } from "../_shared/ai-pipeline-filter.ts";
import { loadLeadContext } from "../pipeline-classify/context.ts";
import { getToggle } from "../_shared/app-settings.ts";
import { runFebracisAgents } from "./agent.ts";
import {
  applyFebracisClassification,
  clearQueueFlagFebracis,
  updateWatermarkFebracis,
  writeSkipTelemetryFebracis
} from "./apply.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_LIMIT = 50;

// Hardcoded Tenant da Febracis para segurança
const FEBRACIS_CLINIC_ID = "ab2f4484-886c-48f2-bfc6-0651d062c575";

function backoffMsForFail(fails: number): number {
  if (fails <= 1) return 2 * 60_000;
  if (fails === 2) return 5 * 60_000;
  return 30 * 60_000;
}

async function isEnabled(client: SupabaseClient, key: string): Promise<boolean> {
  return getToggle(client, key);
}

async function classifyOneFebracis(
  client: SupabaseClient,
  leadId: string,
  force?: boolean,
) {
  // Advisory lock
  const { data: locked, error: lockErr } = await client.rpc("try_classify_lock", { _lead_id: leadId });
  if (lockErr) {
    console.warn("try_classify_lock failed:", lockErr.message);
  } else if (locked === false) {
    return { skipped: "locked_by_other_worker" };
  }

  const loaded = await loadLeadContext(client, leadId, { bypassWatermark: !!force });

  if (loaded.kind === "skip") {
    if (loaded.reason === "no_new_messages") {
      const { data: lead } = await client
        .from("leads")
        .select("last_processed_message_id_classifier, ai_summary")
        .eq("id", leadId)
        .single();
        
      if (lead) {
        await writeSkipTelemetryFebracis(client, leadId, loaded.reason);
        await updateWatermarkFebracis(
          client,
          leadId,
          (lead.last_processed_message_id_classifier as string) ?? "",
          (lead.ai_summary as string) ?? ""
        );
      }
    }
    await clearQueueFlagFebracis(client, leadId);
    return { skipped: loaded.reason };
  }
  
  const ctx = loaded.ctx;

  // Garantia dupla que só opera para a clínica correta
  if (ctx.lead.clinic_id !== FEBRACIS_CLINIC_ID) {
    await writeSkipTelemetryFebracis(client, leadId, "invalid_clinic_routing");
    await clearQueueFlagFebracis(client, leadId);
    return { skipped: "invalid_clinic_routing" };
  }

  if (!(await isAiAllowedForPipeline(client, ctx.lead.clinic_id, ctx.lead.pipeline_id))) {
    await writeSkipTelemetryFebracis(client, leadId, "pipeline_not_in_ai_targets");
    await clearQueueFlagFebracis(client, leadId);
    return { skipped: "pipeline_not_in_ai_targets" };
  }

  // Executa os micro-agentes Flash Lite
  const agentOut = await runFebracisAgents(client, ctx);
  
  if ("error" in agentOut) {
    await writeSkipTelemetryFebracis(client, ctx.lead.id, `agent_error:${agentOut.error}`);
    // Se for timeout ou rate_limit, joga pra fila do backoff
    if (agentOut.error && (agentOut.error.includes("timeout") || agentOut.error.includes("429"))) {
      throw new Error(`agent_error_transient:${agentOut.error}`);
    }
    await clearQueueFlagFebracis(client, ctx.lead.id);
    return { skipped: `agent_error:${agentOut.error}` };
  }

  // Aplica o movimento do funil e salva o novo resumo
  const applyRes = await applyFebracisClassification(
    client,
    ctx,
    agentOut.classification,
    agentOut.newSummary,
    agentOut.telemetry
  );

  return {
    ok: true,
    action: applyRes.actionTaken,
    intent: agentOut.classification.intent,
    telemetry: agentOut.telemetry
  };
}


async function tickQueueFebracis(client: SupabaseClient) {
  if (!(await isEnabled(client, "automation.classifier.enabled"))) {
    return { skipped: "toggle_off" };
  }

  const { data: leads } = await client
    .from("leads")
    .select("id, ai_review_fail_count")
    .eq("needs_ai_review", true)
    .eq("clinic_id", FEBRACIS_CLINIC_ID)
    .lte("ai_review_queued_at", new Date().toISOString())
    .contains("ai_review_reasons", ["pipeline-classifier"])
    .order("ai_review_queued_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);

  const CONCURRENCY = 5;
  const queue = [...(leads ?? [])];
  const results: Array<Record<string, unknown>> = [];

  async function worker() {
    while (queue.length) {
      const l = queue.shift();
      if (!l) break;
      const currentFails = (l.ai_review_fail_count as number | null) ?? 0;
      try {
        const r = await classifyOneFebracis(client, l.id as string);
        results.push({ lead_id: l.id, ok: true, ...r });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("febracis classify failed", l.id, msg);
        results.push({ lead_id: l.id, ok: false, error: msg });
        const nextFails = currentFails + 1;
        await client
          .from("leads")
          .update({
            ai_review_queued_at: new Date(Date.now() + backoffMsForFail(nextFails)).toISOString(),
            ai_review_fail_count: nextFails,
          })
          .eq("id", l.id);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { processed: results.length, results };
}


async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  try {
    const body = await req.json();
    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    let result: unknown;
    
    if (body.action === "tick") {
      result = await tickQueueFebracis(client);
    } else if (body.action === "lead") {
      if (!body.lead_id) throw new Error("lead_id required");
      const force = body.force === true;
      result = await classifyOneFebracis(client, body.lead_id, force);
    } else {
      return new Response(JSON.stringify({ error: "unknown_action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log(JSON.stringify({ edge: "febracis-classifier", action: body.action, result }));
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("pipeline-classify-febracis error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handleRequest);

// supabase/functions/pipeline-classify/index.ts
// Dispatcher V1/V2 (feature flag `automation.classifier.version`)
// + Cron tick + smoke `action:'lead'`.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { handleV1 } from "./index.v1.ts";
import { isClinicPipelineAllowed } from "../_shared/pipeline-allowlist.ts";
import { loadLeadContext } from "./context.ts";
import { runAgent } from "./agent-core.ts";
import {
  applyClassification,
  writeTelemetry,
  writeSkipTelemetry,
  updateWatermark,
} from "./apply.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_LIMIT = 50;

async function getSettingString(
  client: SupabaseClient,
  key: string,
): Promise<string | null> {
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return null;
  return String(data.value).replace(/^"|"$/g, "");
}

async function isEnabled(client: SupabaseClient, key: string): Promise<boolean> {
  const v = await getSettingString(client, key);
  if (!v) return false;
  const s = v.toLowerCase();
  return s === "true" || s === "1";
}

async function clearQueueFlag(client: SupabaseClient, leadId: string) {
  await client
    .from("leads")
    .update({
      needs_ai_review: false,
      ai_review_reasons: [],
      ai_review_queued_at: null,
    })
    .eq("id", leadId);
}

async function classifyOneV2(
  client: SupabaseClient,
  leadId: string,
  onlyAgent?: "summarizer" | "typifier" | "maestro",
) {
  const loaded = await loadLeadContext(client, leadId);
  if (loaded.kind === "skip") {
    // Em modo manual (only_agent) bypassamos o early-return de "no_new_messages":
    // o usuário pediu reprocessamento intencional.
    if (loaded.reason === "no_new_messages" && onlyAgent) {
      // Refaz com bypass: recarrega ignorando watermark
      const { data: leadRow } = await client
        .from("leads")
        .select("last_processed_message_id_classifier")
        .eq("id", leadId)
        .single();
      // Limpa watermark temporariamente seria invasivo — em vez disso, retornamos skip
      // mas marcado como manual_skip para a UI saber que foi pelo watermark.
      if (leadRow) {
        await writeSkipTelemetry(
          client,
          { clinic_id: "", lead_id: leadId },
          `manual_skip_no_new_messages_${onlyAgent}`,
        );
      }
      return { skipped: `no_new_messages_in_${onlyAgent}_mode` };
    }
    if (loaded.reason === "no_new_messages") {
      const { data: lead } = await client
        .from("leads")
        .select("clinic_id, last_processed_message_id_classifier")
        .eq("id", leadId)
        .single();
      if (lead?.clinic_id) {
        await writeSkipTelemetry(
          client,
          { clinic_id: lead.clinic_id as string, lead_id: leadId },
          loaded.reason,
        );
        await updateWatermark(
          client,
          leadId,
          (lead.last_processed_message_id_classifier as string) ?? "",
        );
      }
    }
    await clearQueueFlag(client, leadId);
    return { skipped: loaded.reason };
  }
  const ctx = loaded.ctx;

  if (!(await isClinicPipelineAllowed(client, ctx.lead.clinic_id))) {
    await writeSkipTelemetry(
      client,
      { clinic_id: ctx.lead.clinic_id, lead_id: leadId },
      "clinic_not_allowlisted",
    );
    await updateWatermark(
      client,
      leadId,
      ctx.lead.last_processed_message_id_classifier ?? "",
    );
    await clearQueueFlag(client, leadId);
    return { skipped: "clinic_not_allowlisted" };
  }

  const historyToolEnabled = await isEnabled(
    client,
    "automation.classifier.history_tool_enabled",
  );
  const agentOut = await runAgent(client, ctx, { historyToolEnabled });
  if ("error" in agentOut) {
    await writeSkipTelemetry(
      client,
      { clinic_id: ctx.lead.clinic_id, lead_id: ctx.lead.id },
      `agent_error:${agentOut.error}`,
    );
    await clearQueueFlag(client, ctx.lead.id);
    return { skipped: `agent_error:${agentOut.error}` };
  }

  const { telemetry, lastMessageId } = await applyClassification(
    client,
    ctx,
    agentOut.classification,
    agentOut.usage,
    agentOut.agents,
  );

  await writeTelemetry(client, ctx, telemetry);
  await updateWatermark(client, ctx.lead.id, lastMessageId);

  return { version: 3, classification: agentOut.classification, telemetry };
}


async function tickQueueV2(client: SupabaseClient) {
  if (!(await isEnabled(client, "automation.classifier.enabled"))) {
    return { skipped: "toggle_off" };
  }
  const { data: leads } = await client
    .from("leads")
    .select("id")
    .eq("needs_ai_review", true)
    .lte("ai_review_queued_at", new Date().toISOString())
    .contains("ai_review_reasons", ["pipeline-classifier"])
    .order("ai_review_queued_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);

  // Processa em paralelo (concorrência limitada) para evitar timeout serial.
  const CONCURRENCY = 5;
  const queue = [...(leads ?? [])];
  const results: Array<Record<string, unknown>> = [];

  async function worker() {
    while (queue.length) {
      const l = queue.shift();
      if (!l) break;
      try {
        const r = await classifyOneV2(client, l.id as string);
        results.push({ lead_id: l.id, ok: true, ...r });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("classify v2 failed", l.id, msg);
        results.push({ lead_id: l.id, ok: false, error: msg });
        await client
          .from("leads")
          .update({ ai_review_queued_at: new Date(Date.now() + 10 * 60_000).toISOString() })
          .eq("id", l.id);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { processed: results.length, results };
}

async function handleV2(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    let result: unknown;
    if (body.action === "tick") {
      result = await tickQueueV2(client);
    } else if (body.action === "lead") {
      if (!body.lead_id) throw new Error("lead_id required");
      result = await classifyOneV2(client, body.lead_id);
    } else {
      return new Response(JSON.stringify({ error: "unknown_action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(JSON.stringify({ v: "v2", action: body.action, result }));
    return new Response(JSON.stringify({ ok: true, version: "v2", result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("pipeline-classify v2 error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Override de teste: { force_version: 'v1' | 'v2' } no body ignora a flag.
  // Não consome o body — clona o request.
  let forceVersion: string | null = null;
  let bodyClone: Request = req;
  try {
    const buf = await req.clone().text();
    if (buf) {
      const parsed = JSON.parse(buf);
      if (parsed && typeof parsed.force_version === "string") {
        forceVersion = parsed.force_version;
      }
    }
    // re-build request so downstream handler can read body again
    bodyClone = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: buf,
    });
  } catch {
    /* OPTIONS / no body */
  }

  let version = forceVersion;
  if (!version) {
    try {
      const client = createClient(SUPABASE_URL, SERVICE_KEY);
      version = (await getSettingString(client, "automation.classifier.version")) ?? "v1";
    } catch {
      version = "v1";
    }
  }

  return version === "v2" ? handleV2(bodyClone) : handleV1(bodyClone);
});

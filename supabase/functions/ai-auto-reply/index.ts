// Auto-reply with DEBOUNCE: batches bursts of incoming messages.
// First inbound enqueues a pending_reply; subsequent ones extend run_at.
// scheduled-dispatcher actually fires the reply after the quiet window.
//
// Also enqueues the per-instance "Pipeline Watcher" (silent agent) in parallel,
// regardless of who sent the message — vigia avalia conversa de ambos os lados.
//
// Bot-loop guard: when the incoming message is from_me AND it was sent by an AI
// agent (messages.bot_agent_id set by evolution-send/dispatcher), skip enqueue
// entirely — otherwise every bot reply triggers another watcher run.
import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";
import { isSilentByTools } from "../_shared/agent-flags.ts";

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function fireDispatcherAfter(debounce: number, supabase: any, leadId: string, agentId: string) {
  try {
    await new Promise((r) => setTimeout(r, (debounce + 1) * 1000));
    const { data: still } = await supabase
      .from("pending_replies").select("lead_id").eq("lead_id", leadId).eq("agent_id", agentId).maybeSingle();
    if (!still) return;
    await fetch(`${FUNCTIONS_URL}/scheduled-dispatcher`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: "{}",
    });
  } catch (err) { console.error("dispatcher trigger failed", err); }
}

async function enqueueAgent(supabase: any, leadId: string, clinicId: string, agentId: string, fromMe: boolean) {
  const { data: agent } = await supabase
    .from("ai_agents").select("debounce_seconds, enabled, tools, silent").eq("id", agentId).single();
  if (!agent?.enabled) return { skipped: true, reason: "agent-disabled" };

  const silent = !!agent.silent || isSilentByTools(agent.tools as string[] | null);
  // Mensagens do atendente humano só disparam agentes silenciosos (vigia/classificador).
  if (fromMe && !silent) return { skipped: true, reason: "from_me-non-silent" };

  const debounce = Math.max(Number(agent.debounce_seconds) || 8, 1);
  const runAt = new Date(Date.now() + debounce * 1000).toISOString();
  // IMPORTANT: pass clinic_id explicitly. The column default current_clinic_id()
  // returns NULL when invoked via service role (no auth.uid()), which would
  // silently fail the NOT NULL constraint and break the entire watcher pipeline.
  const { error: upsertErr } = await supabase.from("pending_replies").upsert(
    {
      lead_id: leadId, agent_id: agentId, run_at: runAt, clinic_id: clinicId,
      status: "pending", attempts: 0, last_error: null, claimed_at: null,
    },
    { onConflict: "lead_id,agent_id" },
  );
  if (upsertErr) {
    console.error("pending_replies upsert failed", upsertErr);
    return { skipped: true, reason: "enqueue-failed", error: upsertErr.message };
  }

  // @ts-ignore EdgeRuntime
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(fireDispatcherAfter(debounce, supabase, leadId, agentId));
  }
  return { queued: true, run_at: runAt, silent, debounce_seconds: debounce };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const supabase = sb();

  try {
    const { lead_id, from_me = false } = await req.json();
    if (!lead_id) return json({ error: "lead_id required" }, 400);

    const { data: lead } = await supabase
      .from("leads").select("id, clinic_id, stage_id, pipeline_id, whatsapp_instance_id").eq("id", lead_id).single();
    if (!lead) return json({ error: "lead not found" }, 404);
    if (!lead.clinic_id) return json({ error: "lead missing clinic_id" }, 500);

    // Bot-loop guard: if the most recent message is from_me and came from a bot,
    // skip enqueue entirely. Watchers are silent but still consume tokens.
    if (from_me) {
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("bot_agent_id, from_me")
        .eq("lead_id", lead_id)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMsg?.from_me && lastMsg?.bot_agent_id) {
        return json({ ok: true, skipped: true, reason: "from_bot-loop-guard" });
      }
    }

    const results: Record<string, any> = {};

    // 1. Watcher (silent) per WhatsApp instance — opcionalmente restrito a um pipeline.
    if (lead.whatsapp_instance_id) {
      const { data: inst } = await supabase
        .from("whatsapp_instances").select("watcher_agent_id, watcher_pipeline_id").eq("id", lead.whatsapp_instance_id).maybeSingle();
      if (inst?.watcher_agent_id) {
        if (inst.watcher_pipeline_id && inst.watcher_pipeline_id !== lead.pipeline_id) {
          results.watcher = { skipped: true, reason: "pipeline-mismatch" };
        } else {
          results.watcher = await enqueueAgent(supabase, lead_id, lead.clinic_id, inst.watcher_agent_id, from_me);
        }
      }
    }

    // 2. Sales agent (per-lead override or per-stage default).
    const { data: leadCfg } = await supabase
      .from("lead_ai_settings")
      .select("agent_id, auto_reply, paused_until")
      .eq("lead_id", lead_id).maybeSingle();

    const paused = leadCfg?.paused_until && new Date(leadCfg.paused_until).getTime() > Date.now();
    if (paused) {
      results.sales = { skipped: true, reason: "paused" };
      return json({ ok: true, ...results });
    }

    let agentId: string | null = leadCfg?.agent_id ?? null;
    let autoReply = !!leadCfg?.auto_reply;

    if ((!agentId || !autoReply) && lead.stage_id) {
      const { data: stageCfg } = await supabase
        .from("stage_ai_defaults")
        .select("agent_id, auto_reply").eq("stage_id", lead.stage_id).maybeSingle();
      if (stageCfg) {
        if (!agentId) agentId = stageCfg.agent_id ?? null;
        if (!autoReply) autoReply = !!stageCfg.auto_reply;
      }
    }

    if (autoReply && agentId) {
      results.sales = await enqueueAgent(supabase, lead_id, lead.clinic_id, agentId, from_me);
    } else {
      results.sales = { skipped: true, reason: "not-enabled" };
    }

    return json({ ok: true, ...results });
  } catch (e) {
    console.error("ai-auto-reply", e);
    return json({ error: String(e) }, 500);
  }
});

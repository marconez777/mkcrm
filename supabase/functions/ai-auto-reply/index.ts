// Auto-reply with DEBOUNCE: batches bursts of incoming messages.
// First inbound enqueues a pending_reply; subsequent ones extend run_at.
// scheduled-dispatcher actually fires the reply after the quiet window.
//
// Also enqueues the per-instance "Pipeline Watcher" (silent agent) in parallel,
// regardless of who sent the message — vigia avalia conversa de ambos os lados.
import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";

const SILENT_TOOLS = new Set([
  "move_lead_stage","add_lead_note","set_lead_field","update_custom_field",
  "assign_attendant","remember_fact","transfer_to_human","create_task","schedule_message","get_lead_history",
  "add_lead_tag","remove_lead_tag","get_lead_state","search_knowledge_base",
]);

function isSilentByTools(tools: string[] | null | undefined): boolean {
  if (!tools || tools.length === 0) return false;
  return tools.every((t) => SILENT_TOOLS.has(t));
}

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

async function enqueueAgent(supabase: any, leadId: string, agentId: string, fromMe: boolean) {
  const { data: agent } = await supabase
    .from("ai_agents").select("debounce_seconds, enabled, tools, silent").eq("id", agentId).single();
  if (!agent?.enabled) return { skipped: true, reason: "agent-disabled" };

  const silent = !!agent.silent || isSilentByTools(agent.tools as string[] | null);
  // Mensagens do atendente humano só disparam agentes silenciosos (vigia/classificador).
  if (fromMe && !silent) return { skipped: true, reason: "from_me-non-silent" };

  const debounce = Math.max(Number(agent.debounce_seconds) || 8, 1);
  const runAt = new Date(Date.now() + debounce * 1000).toISOString();
  await supabase.from("pending_replies").upsert(
    { lead_id: leadId, agent_id: agentId, run_at: runAt },
    { onConflict: "lead_id,agent_id" },
  );

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
      .from("leads").select("id, stage_id, whatsapp_instance_id").eq("id", lead_id).single();
    if (!lead) return json({ error: "lead not found" }, 404);

    const results: Record<string, any> = {};

    // 1. Watcher (silent) per WhatsApp instance — sempre tenta, independente de stage default.
    if (lead.whatsapp_instance_id) {
      const { data: inst } = await supabase
        .from("whatsapp_instances").select("watcher_agent_id").eq("id", lead.whatsapp_instance_id).maybeSingle();
      if (inst?.watcher_agent_id) {
        results.watcher = await enqueueAgent(supabase, lead_id, inst.watcher_agent_id, from_me);
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
      results.sales = await enqueueAgent(supabase, lead_id, agentId, from_me);
    } else {
      results.sales = { skipped: true, reason: "not-enabled" };
    }

    return json({ ok: true, ...results });
  } catch (e) {
    console.error("ai-auto-reply", e);
    return json({ error: String(e) }, 500);
  }
});

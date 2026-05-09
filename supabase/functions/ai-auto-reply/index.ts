// Auto-reply with DEBOUNCE: batches bursts of incoming messages.
// First inbound enqueues a pending_reply; subsequent ones extend run_at.
// scheduled-dispatcher actually fires the reply after the quiet window.
import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";

// Tools that produce ZERO outbound text. If an agent only uses these,
// it's a "silent" agent (e.g. classificador de pipeline) and can also be
// triggered by from_me messages to re-evaluate the funnel.
const SILENT_TOOLS = new Set([
  "move_lead_stage",
  "add_lead_note",
  "set_lead_field",
  "update_custom_field",
  "assign_attendant",
  "remember_fact",
  "transfer_to_human",
  "create_task",
  "schedule_message",
  "get_lead_history",
]);

function isSilentAgent(tools: string[] | null | undefined): boolean {
  if (!tools || tools.length === 0) return false;
  return tools.every((t) => SILENT_TOOLS.has(t));
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
      .from("leads").select("id, stage_id").eq("id", lead_id).single();
    if (!lead) return json({ error: "lead not found" }, 404);

    // Resolve agent: per-lead first, then per-stage default.
    const { data: leadCfg } = await supabase
      .from("lead_ai_settings")
      .select("agent_id, auto_reply, paused_until")
      .eq("lead_id", lead_id).maybeSingle();

    let agentId: string | null = leadCfg?.agent_id ?? null;
    let autoReply = !!leadCfg?.auto_reply;

    if (leadCfg?.paused_until && new Date(leadCfg.paused_until).getTime() > Date.now()) {
      return json({ skipped: true, reason: "paused" });
    }

    // Fallback to stage default whenever the lead-level config didn't fully
    // resolve an enabled agent (handles the "empty lead_ai_settings row" case).
    if ((!agentId || !autoReply) && lead.stage_id) {
      const { data: stageCfg } = await supabase
        .from("stage_ai_defaults")
        .select("agent_id, auto_reply").eq("stage_id", lead.stage_id).maybeSingle();
      if (stageCfg) {
        if (!agentId) agentId = stageCfg.agent_id ?? null;
        if (!autoReply) autoReply = !!stageCfg.auto_reply;
      }
    }

    if (!autoReply || !agentId) return json({ skipped: true, reason: "not-enabled" });

    // Look up agent
    const { data: agent } = await supabase
      .from("ai_agents").select("debounce_seconds, enabled, tools, silent").eq("id", agentId).single();
    if (!agent?.enabled) return json({ skipped: true, reason: "agent-disabled" });

    // For from_me messages, only silent agents (classificador/watcher) should run —
    // a chatty agent must never reply on top of the human atendente.
    const silent = !!agent.silent || isSilentAgent(agent.tools as string[] | null);
    if (from_me && !silent) return json({ skipped: true, reason: "from_me-non-silent" });

    const debounce = Math.max(Number(agent.debounce_seconds) || 8, 1);
    const runAt = new Date(Date.now() + debounce * 1000).toISOString();

    // Upsert pending reply (extends run_at se já houver fila para esse (lead, agente))
    await supabase.from("pending_replies").upsert({
      lead_id, agent_id: agentId, run_at: runAt,
    }, { onConflict: "lead_id,agent_id" });

    // Trigger scheduled-dispatcher once after the debounce window expires.
    // pg_cron also runs every minute as a safety net; the dispatcher uses
    // an atomic DELETE…RETURNING claim so concurrent runs are safe.
    const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const fireDispatcher = async () => {
      try {
        await new Promise((r) => setTimeout(r, (debounce + 1) * 1000));
        const { data: still } = await supabase
          .from("pending_replies").select("lead_id").eq("lead_id", lead_id).maybeSingle();
        if (!still) return;
        await fetch(`${FUNCTIONS_URL}/scheduled-dispatcher`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: "{}",
        });
      } catch (err) {
        console.error("dispatcher trigger failed", err);
      }
    };
    // @ts-ignore EdgeRuntime is provided by Supabase Functions
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(fireDispatcher());
    }

    return json({ ok: true, queued: true, run_at: runAt, debounce_seconds: debounce, silent });
  } catch (e) {
    console.error("ai-auto-reply", e);
    return json({ error: String(e) }, 500);
  }
});

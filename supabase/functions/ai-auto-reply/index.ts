// Auto-reply with DEBOUNCE: batches bursts of incoming messages.
// First inbound enqueues a pending_reply; subsequent ones extend run_at.
// scheduled-dispatcher actually fires the reply after the quiet window.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const { lead_id } = await req.json();
    if (!lead_id) return json({ error: "lead_id required" }, 400);

    const { data: lead } = await supabase
      .from("leads").select("id, stage_id").eq("id", lead_id).single();
    if (!lead) return json({ error: "lead not found" }, 404);

    // Resolve agent: per-lead first, then per-stage default.
    const { data: leadCfg } = await supabase
      .from("lead_ai_settings")
      .select("agent_id, auto_reply, paused_until")
      .eq("lead_id", lead_id).maybeSingle();

    let agentId: string | null = null;
    let autoReply = false;

    if (leadCfg) {
      autoReply = !!leadCfg.auto_reply;
      agentId = leadCfg.agent_id ?? null;
      if (leadCfg.paused_until && new Date(leadCfg.paused_until).getTime() > Date.now()) {
        return json({ skipped: true, reason: "paused" });
      }
    }

    if ((!agentId || !leadCfg) && lead.stage_id) {
      const { data: stageCfg } = await supabase
        .from("stage_ai_defaults")
        .select("agent_id, auto_reply").eq("stage_id", lead.stage_id).maybeSingle();
      if (stageCfg) {
        if (!leadCfg) autoReply = !!stageCfg.auto_reply;
        if (!agentId) agentId = stageCfg.agent_id;
      }
    }

    if (!autoReply || !agentId) return json({ skipped: true, reason: "not-enabled" });

    // Look up debounce window from agent
    const { data: agent } = await supabase
      .from("ai_agents").select("debounce_seconds, enabled").eq("id", agentId).single();
    if (!agent?.enabled) return json({ skipped: true, reason: "agent-disabled" });
    const debounce = Math.max(Number(agent.debounce_seconds) || 8, 1);
    const runAt = new Date(Date.now() + debounce * 1000).toISOString();

    // Upsert pending reply (extends run_at if exists)
    await supabase.from("pending_replies").upsert({
      lead_id, agent_id: agentId, run_at: runAt,
    }, { onConflict: "lead_id" });

    // Trigger scheduled-dispatcher once after the debounce window expires.
    // pg_cron also runs every minute as a safety net; the dispatcher uses
    // an atomic DELETE…RETURNING claim so concurrent runs are safe.
    const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const fireDispatcher = async () => {
      try {
        await new Promise((r) => setTimeout(r, (debounce + 1) * 1000));
        // Re-check: only fire if THIS lead's pending row is still due (not already
        // claimed by another invocation or the cron). Avoids burst spam.
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

    return json({ ok: true, queued: true, run_at: runAt, debounce_seconds: debounce });
  } catch (e) {
    console.error("ai-auto-reply", e);
    return json({ error: String(e) }, 500);
  }
});

// Phase 14c — Stage-driven follow-up dispatcher.
// Scheduled via pg_cron (every 5 minutes). Looks at lead_ai_settings rows where
// the lead has been sitting in the current stage longer than the stage's
// `follow_up_after_min` window and the agent has stages enabled, then queues
// the follow-up message via scheduled_messages (or inserts an internal note if
// no message text is configured). Idempotent: writes last_followup_at and skips
// rows already followed-up within the same window.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // Tick público — chamado por pg_cron (sem Authorization Bearer). verify_jwt=false em config.toml.
  const supabase = sb();
  const startedAt = Date.now();

  try {
    // Pull lead settings that have a current stage and aren't paused.
    const { data: rows, error } = await supabase
      .from("lead_ai_settings")
      .select("lead_id, agent_id, current_stage_id, stage_entered_at, last_followup_at, paused_until, auto_reply")
      .not("current_stage_id", "is", null);
    if (error) return json({ error: error.message }, 500);

    const candidates = (rows ?? []).filter((r: any) => {
      if (r.auto_reply === false) return false;
      if (r.paused_until && new Date(r.paused_until) > new Date()) return false;
      return true;
    });

    if (candidates.length === 0) {
      return json({ ok: true, checked: 0, dispatched: 0, elapsed_ms: Date.now() - startedAt });
    }

    // Load distinct stage + agent metadata in one go.
    const stageIds = [...new Set(candidates.map((r: any) => r.current_stage_id))];
    const agentIds = [...new Set(candidates.map((r: any) => r.agent_id).filter(Boolean))];

    const [{ data: stages }, { data: agents }] = await Promise.all([
      supabase
        .from("agent_stages")
        .select("id, name, follow_up_after_min, follow_up_message")
        .in("id", stageIds),
      supabase
        .from("ai_agents")
        .select("id, stages_enabled")
        .in("id", agentIds),
    ]);

    const stageMap = new Map<string, any>((stages ?? []).map((s: any) => [s.id, s]));
    const agentMap = new Map<string, any>((agents ?? []).map((a: any) => [a.id, a]));

    let dispatched = 0;
    const now = Date.now();

    for (const r of candidates as any[]) {
      const stage = stageMap.get(r.current_stage_id);
      const agent = agentMap.get(r.agent_id);
      if (!stage || !agent?.stages_enabled) continue;
      const windowMin = Number(stage.follow_up_after_min) || 0;
      if (windowMin <= 0) continue;
      const enteredAt = r.stage_entered_at ? new Date(r.stage_entered_at).getTime() : null;
      if (!enteredAt) continue;
      const ageMin = (now - enteredAt) / 60_000;
      if (ageMin < windowMin) continue;
      // Skip if we already followed up after the lead entered this stage.
      if (r.last_followup_at && new Date(r.last_followup_at).getTime() >= enteredAt) continue;

      const text = String(stage.follow_up_message ?? "").trim();
      try {
        if (text) {
          await supabase.from("scheduled_messages").insert({
            lead_id: r.lead_id,
            content: text,
            send_at: new Date().toISOString(),
          });
        } else {
          await supabase.from("lead_internal_notes").insert({
            lead_id: r.lead_id,
            author_name: "IA",
            text: `Follow-up automático sugerido: lead parado no estágio "${stage.name}" há ${Math.round(ageMin)} min.`,
          });
        }
        await supabase
          .from("lead_ai_settings")
          .update({ last_followup_at: new Date().toISOString() })
          .eq("lead_id", r.lead_id);
        dispatched++;
      } catch (e) {
        console.error("[followups] dispatch error", r.lead_id, e);
      }
    }

    return json({
      ok: true,
      checked: candidates.length,
      dispatched,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("agent-followups-tick", e);
    return json({ error: String(e) }, 500);
  }
});

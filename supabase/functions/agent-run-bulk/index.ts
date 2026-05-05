// Enqueues pending_replies for all active leads with a given agent,
// so the scheduled-dispatcher will run the agent (e.g. classifier) over them.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { agent_id, only_with_inbound = true, limit = 1000 } = await req.json();
    if (!agent_id) return json({ error: "agent_id required" }, 400);

    const supabase = sb();
    // Confirm agent exists & enabled
    const { data: agent } = await supabase.from("ai_agents").select("id, enabled").eq("id", agent_id).maybeSingle();
    if (!agent) return json({ error: "agent not found" }, 404);

    // Fetch active (non-archived) leads
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, last_message_at")
      .is("archived_at", null)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) return json({ error: error.message }, 500);

    let enqueued = 0;
    const now = new Date().toISOString();
    for (const l of leads ?? []) {
      // Optionally skip leads with no inbound message
      if (only_with_inbound) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", l.id).eq("from_me", false).limit(1);
        if (!count) continue;
      }
      // upsert pending reply (PK = lead_id)
      const { error: upErr } = await supabase
        .from("pending_replies")
        .upsert({ lead_id: l.id, agent_id, run_at: now }, { onConflict: "lead_id" });
      if (!upErr) enqueued++;
    }

    return json({ ok: true, enqueued, total: leads?.length ?? 0 });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

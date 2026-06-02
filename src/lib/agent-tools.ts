// Whitelist of tools known to the ai-chat runtime. Used by the Agent Wizard
// to filter LLM-suggested tools before persisting them in ai_agents.tools,
// so a hallucinated tool name doesn't break the agent at runtime.
//
// Keep in sync with supabase/functions/_shared/agent-flags.ts and the tools
// registered in supabase/functions/ai-chat/index.ts.

export const KNOWN_AGENT_TOOLS = new Set<string>([
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
  "add_lead_tag",
  "remove_lead_tag",
  "get_lead_state",
  "search_knowledge_base",
  "generate_insight_report",
]);

export function filterKnownTools(tools: string[] | null | undefined): string[] {
  if (!tools) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tools) {
    if (typeof t !== "string") continue;
    const name = t.trim();
    if (!name || seen.has(name) || !KNOWN_AGENT_TOOLS.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

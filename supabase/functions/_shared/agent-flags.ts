// Shared constants for agent classification.
// Imported by ai-auto-reply and scheduled-dispatcher so adding a new tool
// only requires editing this file.

export const SILENT_TOOLS = new Set<string>([
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

export function isSilentByTools(tools: string[] | null | undefined): boolean {
  if (!tools || tools.length === 0) return false;
  return tools.every((t) => SILENT_TOOLS.has(t));
}

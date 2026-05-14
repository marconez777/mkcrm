// Helper to record AI usage rows from edge functions.
// Resolves clinic_id from agent_id (or lead_id) when not provided, since service-role
// inserts cannot rely on the current_clinic_id() default.
import { sb } from "./evolution.ts";

export type UsageRecord = {
  clinic_id?: string | null;
  agent_id?: string | null;
  automation_id?: string | null;
  lead_id?: string | null;
  thread_id?: string | null;
  model: string;
  operation?: "chat" | "embed" | "tool";
  status?: "success" | "error" | "rate_limit" | "no_credits";
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  latency_ms?: number | null;
  tools_called?: number;
  replied?: boolean;
  error?: string | null;
};

export async function logUsage(rec: UsageRecord) {
  try {
    const supabase = sb();
    let clinic_id = rec.clinic_id ?? null;
    if (!clinic_id && rec.agent_id) {
      const { data } = await supabase.from("ai_agents").select("clinic_id").eq("id", rec.agent_id).maybeSingle();
      clinic_id = data?.clinic_id ?? null;
    }
    if (!clinic_id && rec.lead_id) {
      const { data } = await supabase.from("leads").select("clinic_id").eq("id", rec.lead_id).maybeSingle();
      clinic_id = data?.clinic_id ?? null;
    }
    if (!clinic_id) {
      console.warn("logUsage skipped: clinic_id unresolved", { model: rec.model, op: rec.operation });
      return;
    }
    await supabase.from("ai_usage").insert({
      operation: "chat",
      status: "success",
      tools_called: 0,
      replied: false,
      ...rec,
      clinic_id,
    });
  } catch (e) {
    console.error("logUsage failed", e);
  }
}

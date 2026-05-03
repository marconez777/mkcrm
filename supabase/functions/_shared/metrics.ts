// Helper to record AI usage rows from edge functions.
import { sb } from "./evolution.ts";

export type UsageRecord = {
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
    await supabase.from("ai_usage").insert({
      operation: "chat",
      status: "success",
      tools_called: 0,
      replied: false,
      ...rec,
    });
  } catch (e) {
    console.error("logUsage failed", e);
  }
}

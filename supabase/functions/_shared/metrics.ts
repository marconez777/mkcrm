// Helper to record AI usage rows from edge functions.
// Resolves clinic_id from agent_id (or lead_id) when not provided, since service-role
// inserts cannot rely on the current_clinic_id() default.
// Materializes cost_usd at insert time using ai-pricing.ts so historic rows
// keep the price-of-the-day even if pricing changes later.
import { sb } from "./evolution.ts";
import { calcCostUsd } from "./ai-pricing.ts";

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
  source?: string | null;
  provider?: string | null;
  agent_step?: string | null;
  error_category?: string | null;
  error_details?: Record<string, unknown> | null;
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
    const cost_usd = calcCostUsd(rec.model, rec.input_tokens, rec.output_tokens);
    // Derive a stable `source` tag so the Custos UI can split surfaces:
    //   classifier:*  → classifier-runtime (pipeline IA)
    //   embed         → embeddings (ingest/RAG)
    //   chat          → agent-runtime (atendimento ao lead)
    //   tool          → agent-tool (chamadas internas do agente)
    const op = rec.operation;
    const derivedSource = op?.startsWith("classifier:")
      ? "classifier-runtime"
      : op === "embed"
        ? "embeddings"
        : op === "tool"
          ? "agent-tool"
          : op === "chat" || !op
            ? "agent-runtime"
            : "unknown";
    await supabase.from("ai_usage").insert({
      operation: "chat",
      status: "success",
      tools_called: 0,
      replied: false,
      source: derivedSource,
      ...rec,
      clinic_id,
      cost_usd,
    });
  } catch (e) {
    console.error("logUsage failed", e);
  }
}

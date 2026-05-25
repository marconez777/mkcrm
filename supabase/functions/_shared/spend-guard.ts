// Shared guard for AI edge functions. Blocks calls when the clinic
// has hit its daily USD limit. Resolves clinic_id from agent_id / lead_id
// the same way logUsage does, so callers can pass whichever id they have.
import { sb } from "./evolution.ts";

export class SpendLimitExceeded extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(body: Record<string, unknown>) {
    super("daily_spend_limit_reached");
    this.status = 402;
    this.body = body;
  }
}

export async function resolveClinicId(opts: {
  clinic_id?: string | null;
  agent_id?: string | null;
  lead_id?: string | null;
}): Promise<string | null> {
  if (opts.clinic_id) return opts.clinic_id;
  const supabase = sb();
  if (opts.agent_id) {
    const { data } = await supabase.from("ai_agents").select("clinic_id").eq("id", opts.agent_id).maybeSingle();
    if (data?.clinic_id) return data.clinic_id;
  }
  if (opts.lead_id) {
    const { data } = await supabase.from("leads").select("clinic_id").eq("id", opts.lead_id).maybeSingle();
    if (data?.clinic_id) return data.clinic_id;
  }
  return null;
}

export async function assertSpendAllowed(clinic_id: string | null): Promise<void> {
  if (!clinic_id) return; // unresolved -> let it pass (logging handles it)
  try {
    const supabase = sb();
    const { data, error } = await supabase.rpc("check_ai_spend_status", { p_clinic_id: clinic_id });
    if (error) {
      console.warn("[spend-guard] check failed", error.message);
      return;
    }
    const status = data as { allowed?: boolean; spent_today_usd?: number; limit_usd?: number; percent?: number; configured?: boolean };
    if (status && status.configured && status.allowed === false) {
      throw new SpendLimitExceeded({
        error: "daily_spend_limit_reached",
        spent_usd: status.spent_today_usd,
        limit_usd: status.limit_usd,
        percent: status.percent,
        message: "Limite diário de gasto com IA atingido para esta clínica.",
      });
    }
  } catch (e) {
    if (e instanceof SpendLimitExceeded) throw e;
    console.warn("[spend-guard] unexpected", (e as Error).message);
  }
}

export function spendLimitResponse(err: SpendLimitExceeded, corsHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(err.body), {
    status: err.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

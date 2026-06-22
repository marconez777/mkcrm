// pipeline-queue-alert: detecta gargalos no pipeline e registra em error_events.
// Cron: a cada 10 min. Sem JWT (chamado por pg_cron).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PENDING_THRESHOLD = 10;
const ERROR_RATE_THRESHOLD = 0.05;
const DEDUP_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    // Fila pendente: leads marcados para revisão há mais de 10 min.
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: pendingCount } = await sb
      .from("leads")
      .select("id", { head: true, count: "exact" })
      .eq("needs_ai_review", true)
      .lt("ai_review_queued_at", tenMinAgo);

    // Taxa de erro nas últimas 1h em auto:classifier (payload.skipped indica erro/skip).
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: classifyEvents } = await sb
      .from("lead_events")
      .select("payload")
      .eq("type", "auto:classifier")
      .gte("created_at", oneHourAgo)
      .limit(5000);

    const total = classifyEvents?.length ?? 0;
    const errors = (classifyEvents ?? []).filter((e: any) => {
      const p = e.payload ?? {};
      return p?.skipped?.error || p?.applied?.summarize?.status === "error";
    }).length;
    const errorRate = total > 0 ? errors / total : 0;

    const pending = pendingCount ?? 0;
    const shouldAlert = pending > PENDING_THRESHOLD || errorRate > ERROR_RATE_THRESHOLD;

    let alerted = false;
    if (shouldAlert) {
      // Dedup: já existe alerta da mesma source nos últimos 30 min?
      const dedupSince = new Date(Date.now() - DEDUP_MINUTES * 60 * 1000).toISOString();
      const { count: recentCount } = await sb
        .from("error_events")
        .select("id", { head: true, count: "exact" })
        .eq("function_name", "pipeline-queue-alert")
        .gte("created_at", dedupSince);

      if ((recentCount ?? 0) === 0) {
        await sb.from("error_events").insert({
          function_name: "pipeline-queue-alert",
          severity: "warning",
          error_message: `Pipeline saturado: pending=${pending}, error_rate=${(errorRate * 100).toFixed(1)}%`,
          metadata: {
            pending_count: pending,
            error_rate: Number(errorRate.toFixed(4)),
            classify_total_1h: total,
            classify_errors_1h: errors,
            thresholds: { pending: PENDING_THRESHOLD, error_rate: ERROR_RATE_THRESHOLD },
          },
        });
        alerted = true;
      }
    }

    return new Response(
      JSON.stringify({ pending_count: pending, error_rate: errorRate, classify_total_1h: total, classify_errors_1h: errors, alerted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

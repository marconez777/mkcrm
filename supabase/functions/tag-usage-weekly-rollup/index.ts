// tag-usage-weekly-rollup: agrega uso de tags da semana anterior em tag_usage_weekly.
// Cron: semanal, segunda 06:00 UTC. Sem JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function startOfIsoWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7; // 1..7 (Mon..Sun)
  if (day !== 1) x.setUTCDate(x.getUTCDate() - (day - 1));
  return x;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const now = new Date();
    const thisWeekStart = startOfIsoWeek(now);
    const prevWeekStart = new Date(thisWeekStart);
    prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);

    const fromIso = prevWeekStart.toISOString();
    const toIso = thisWeekStart.toISOString();
    const weekStartDate = prevWeekStart.toISOString().slice(0, 10); // YYYY-MM-DD

    // Pagina lead_events do período.
    const emitCount = new Map<string, number>();
    const applyCount = new Map<string, number>();
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await sb
        .from("lead_events")
        .select("payload")
        .eq("type", "auto:classifier")
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of data as Array<{ payload: any }>) {
        const p = row.payload ?? {};
        const emitted: string[] = Array.isArray(p.tags_suggested) ? p.tags_suggested : [];
        for (const t of emitted) {
          if (typeof t === "string" && t) emitCount.set(t, (emitCount.get(t) ?? 0) + 1);
        }
        const added: string[] = p?.applied?.tags?.added;
        if (Array.isArray(added)) {
          for (const t of added) {
            if (typeof t === "string" && t) applyCount.set(t, (applyCount.get(t) ?? 0) + 1);
          }
        }
      }

      if (data.length < pageSize) break;
      from += pageSize;
    }

    const allTags = new Set<string>([...emitCount.keys(), ...applyCount.keys()]);
    const rows = Array.from(allTags).map((tag) => ({
      tag,
      week_start: weekStartDate,
      emit_count: emitCount.get(tag) ?? 0,
      applied_count: applyCount.get(tag) ?? 0,
      updated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error: upErr } = await sb
        .from("tag_usage_weekly")
        .upsert(rows, { onConflict: "tag,week_start" });
      if (upErr) throw upErr;
    }

    return new Response(
      JSON.stringify({ week_start: weekStartDate, tags_processed: rows.length }),
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

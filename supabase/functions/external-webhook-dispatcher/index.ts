// Sends queued external webhook deliveries (CRM -> external site).
// Two modes:
//   POST { id }  -> dispatch a single delivery immediately
//   POST {}      -> tick: pick up to 50 pending deliveries due now (cron)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const SECRET = Deno.env.get("EXTERNAL_APP_WEBHOOK_SECRET") || "";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

function nextDelayMs(attempts: number): number {
  // attempts is the count AFTER incrementing. backoff schedule:
  // 1st failure -> +1min, 2nd -> +5min, 3rd+ -> +30min
  if (attempts <= 1) return 60 * 1000;
  if (attempts === 2) return 5 * 60 * 1000;
  return 30 * 60 * 1000;
}

async function deliver(supabase: any, row: any): Promise<void> {
  const startedAt = Date.now();
  let statusCode = 0;
  let errorMsg: string | null = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const resp = await fetch(row.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SECRET}`,
      },
      body: JSON.stringify(row.payload),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    statusCode = resp.status;
    if (resp.ok) {
      await supabase.from("external_webhook_deliveries").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_status_code: statusCode,
        last_attempt_at: new Date().toISOString(),
        last_error: null,
        attempts: row.attempts + 1,
      }).eq("id", row.id);
      return;
    }
    errorMsg = `HTTP ${statusCode}: ${(await resp.text()).slice(0, 500)}`;
  } catch (e) {
    errorMsg = String(e).slice(0, 500);
  }

  const attempts = row.attempts + 1;
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  const isDead = ageMs >= MAX_AGE_MS;
  const nextAt = new Date(Date.now() + nextDelayMs(attempts)).toISOString();

  await supabase.from("external_webhook_deliveries").update({
    status: isDead ? "dead" : "pending",
    attempts,
    last_status_code: statusCode || null,
    last_error: errorMsg,
    last_attempt_at: new Date().toISOString(),
    next_attempt_at: nextAt,
  }).eq("id", row.id);

  console.log("ewd delivery failed", { id: row.id, attempts, statusCode, errorMsg, ms: Date.now() - startedAt });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  if (!SECRET) {
    console.error("EXTERNAL_APP_WEBHOOK_SECRET missing");
    return json({ error: "secret_missing" }, 500);
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const supabase = sb();

  try {
    if (body?.id) {
      const { data: row } = await supabase
        .from("external_webhook_deliveries")
        .select("*")
        .eq("id", body.id)
        .maybeSingle();
      if (!row) return json({ error: "not_found" }, 404);
      if (row.status === "sent" || row.status === "dead") return json({ ok: true, skipped: row.status });
      await deliver(supabase, row);
      return json({ ok: true });
    }

    // Tick mode: pick due pending
    const { data: rows } = await supabase
      .from("external_webhook_deliveries")
      .select("*")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("next_attempt_at", { ascending: true })
      .limit(50);

    let processed = 0;
    for (const row of rows ?? []) {
      await deliver(supabase, row);
      processed++;
    }
    return json({ ok: true, processed });
  } catch (err) {
    console.error("external-webhook-dispatcher", err);
    return json({ error: String(err) }, 500);
  }
});

// Edge Function: enqueue-campaign
// Enfileira os destinatarios de uma campanha em fatias, chamando
// public.enqueue_campaign_chunk repetidamente ate done=true.
// Service-role only. Self-trigger quando o wall-clock estoura.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

const MAX_WALL_MS = 100_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token !== SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const campaign_id = body?.campaign_id;
    if (!campaign_id) return jsonResponse({ error: "missing campaign_id" }, { status: 400 });

    let limit = 5000;
    const started = Date.now();
    let pending = false;
    let total: number | null = null;

    // deno-lint-ignore no-constant-condition
    while (true) {
      const { data, error } = await supabase.rpc("enqueue_campaign_chunk", {
        _campaign_id: campaign_id,
        _limit: limit,
      });

      if (error) {
        const msg = error.message ?? String(error);
        if (/statement timeout|canceling statement/i.test(msg)) {
          limit = Math.max(500, Math.floor(limit / 2));
          console.warn(`enqueue-campaign: timeout, reduzindo limit para ${limit}`);
          if (Date.now() - started > MAX_WALL_MS) { pending = true; break; }
          continue;
        }
        await supabase.from("email_campaigns").update({
          status: "failed", error: msg, updated_at: new Date().toISOString(),
        }).eq("id", campaign_id);
        return jsonResponse({ error: msg }, { status: 500 });
      }

      const res = (data ?? {}) as { done?: boolean; inserted?: number; total?: number; reason?: string };
      if (typeof res.total === "number") total = res.total;

      if (res.reason === "locked") {
        if (Date.now() - started > MAX_WALL_MS) { pending = true; break; }
        await sleep(2000);
        continue;
      }

      if (res.done === true) break;

      if (Date.now() - started > MAX_WALL_MS) { pending = true; break; }
    }

    if (pending) {
      fetch(`${SUPABASE_URL}/functions/v1/enqueue-campaign`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id }),
      }).catch(() => {});
    }

    fetch(`${SUPABASE_URL}/functions/v1/process-email-queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});

    return jsonResponse({ ok: true, total, done: !pending }, { status: 202 });
  } catch (e) {
    console.error("enqueue-campaign error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});

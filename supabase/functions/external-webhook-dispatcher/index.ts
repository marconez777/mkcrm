// Sends queued external webhook deliveries (CRM -> external site).
// Two modes:
//   POST { id }  -> dispatch a single delivery immediately
//   POST {}      -> tick: pick up to 50 pending deliveries due now (cron)
//
// Signs each request with HMAC-SHA256 v1 using the per-tenant
// tracking_sites.webhook_secret_out. Falls back to EXTERNAL_APP_WEBHOOK_SECRET
// only for legacy rows without site_id (e.g. crm-whatsapp-confirmed).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const FALLBACK_SECRET = Deno.env.get("EXTERNAL_APP_WEBHOOK_SECRET") || "";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const DEBUG_HMAC = Deno.env.get("DEBUG_HMAC") === "1";

function nextDelayMs(attempts: number): number {
  if (attempts <= 1) return 60 * 1000;
  if (attempts === 2) return 5 * 60 * 1000;
  return 30 * 60 * 1000;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toHex(sig);
}

async function markDead(supabase: any, id: string, reason: string, attempts: number) {
  await supabase.from("external_webhook_deliveries").update({
    status: "dead",
    attempts,
    last_error: reason,
    last_attempt_at: new Date().toISOString(),
  }).eq("id", id);
}

async function deliver(supabase: any, row: any, secretCache: Map<string, string>): Promise<void> {
  const startedAt = Date.now();

  // Resolve signing secret
  let secret = "";
  if (row.site_id) {
    if (secretCache.has(row.site_id)) {
      secret = secretCache.get(row.site_id) || "";
    } else {
      const { data: site } = await supabase
        .from("tracking_sites")
        .select("webhook_secret_out")
        .eq("id", row.site_id)
        .maybeSingle();
      secret = site?.webhook_secret_out || "";
      secretCache.set(row.site_id, secret);
    }
  }
  if (!secret) secret = FALLBACK_SECRET;
  if (!secret) {
    await markDead(supabase, row.id, "no_signing_secret", row.attempts + 1);
    console.log("ewd dead", { id: row.id, reason: "no_signing_secret" });
    return;
  }

  // event_id is REQUIRED — site uses it for idempotency
  const eventId = row.payload?.event_id;
  if (!eventId) {
    await markDead(supabase, row.id, "missing_event_id", row.attempts + 1);
    console.log("ewd dead", { id: row.id, reason: "missing_event_id" });
    return;
  }

  const body = JSON.stringify(row.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signed = `v1:${timestamp}:${body}`;
  const signatureHex = await hmacSha256Hex(secret, signed);

  if (DEBUG_HMAC) {
    console.log("ewd hmac-debug", {
      id: row.id,
      site_id: row.site_id,
      event_type: row.type,
      event_id: eventId,
      timestamp,
      signed_preview: signed.slice(0, 200) + (signed.length > 200 ? "…" : ""),
      signed_len: signed.length,
      body,
      signature: signatureHex,
    });
  }

  let statusCode = 0;
  let errorMsg: string | null = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const resp = await fetch(row.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CRM-Event": row.type ?? "",
        "X-CRM-Event-Id": String(eventId),
        "X-CRM-Timestamp": timestamp,
        "X-CRM-Signature": `v1=${signatureHex}`,
      },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    statusCode = resp.status;
    const respText = await resp.text();
    if (resp.ok) {
      await supabase.from("external_webhook_deliveries").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        last_status_code: statusCode,
        last_attempt_at: new Date().toISOString(),
        last_error: null,
        attempts: row.attempts + 1,
      }).eq("id", row.id);
      console.log("ewd sent", {
        id: row.id,
        status: statusCode,
        ms: Date.now() - startedAt,
        resp_body: respText.slice(0, 1000),
      });
      return;
    }
    errorMsg = `HTTP ${statusCode}: ${respText.slice(0, 500)}`;
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

  let body: any = {};
  try { body = await req.json(); } catch {}
  const supabase = sb();
  const secretCache = new Map<string, string>();

  try {
    if (body?.id) {
      const { data: row } = await supabase
        .from("external_webhook_deliveries")
        .select("*")
        .eq("id", body.id)
        .maybeSingle();
      if (!row) return json({ error: "not_found" }, 404);
      if (row.status === "sent" || row.status === "dead") return json({ ok: true, skipped: row.status });
      await deliver(supabase, row, secretCache);
      return json({ ok: true });
    }

    const { data: rows } = await supabase
      .from("external_webhook_deliveries")
      .select("*")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("next_attempt_at", { ascending: true })
      .limit(50);

    let processed = 0;
    for (const row of rows ?? []) {
      await deliver(supabase, row, secretCache);
      processed++;
    }
    return json({ ok: true, processed });
  } catch (err) {
    console.error("external-webhook-dispatcher", err);
    return json({ error: String(err) }, 500);
  }
});

// Public ingestion endpoint for the website pixel.
// Receives pageviews / clicks / wa_clicks and stores them under a session.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-site-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const sha256Hex = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const detectDevice = (ua: string): string => {
  const u = ua.toLowerCase();
  if (/ipad|tablet/.test(u)) return "tablet";
  if (/mobi|android|iphone/.test(u)) return "mobile";
  return "desktop";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  try {
    const body = await req.json();
    const siteToken: string | undefined = body.siteToken ?? req.headers.get("x-site-token") ?? undefined;
    const sessionId: string | undefined = body.sessionId;
    const event = body.event ?? {};
    if (!siteToken || !sessionId || !event?.type) return json({ error: "missing fields" }, 400);

    const supabase = sb();

    // resolve site
    const { data: site } = await supabase
      .from("tracking_sites")
      .select("id, clinic_id")
      .eq("ingest_token", siteToken)
      .maybeSingle();
    if (!site) return json({ error: "invalid token" }, 401);

    // ensure session
    const { data: existing } = await supabase
      .from("tracking_sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();

    if (!existing) {
      const ua = req.headers.get("user-agent") ?? "";
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
      const meta = body.meta ?? {};
      const insertSession = {
        id: sessionId,
        clinic_id: site.clinic_id,
        site_id: site.id,
        ref_short: sessionId.replace(/-/g, "").toLowerCase().slice(0, 10),
        ref: meta.ref ?? null,
        utm_source: meta.utm_source ?? null,
        utm_medium: meta.utm_medium ?? null,
        utm_campaign: meta.utm_campaign ?? null,
        utm_term: meta.utm_term ?? null,
        utm_content: meta.utm_content ?? null,
        first_url: event.url ?? null,
        first_referrer: event.referrer ?? meta.referrer ?? null,
        landing_title: event.title ?? null,
        user_agent: ua,
        device: detectDevice(ua),
        country: req.headers.get("cf-ipcountry") ?? req.headers.get("x-country") ?? null,
        ip_hash: ip ? await sha256Hex(ip) : null,
      };
      const { error: sessErr } = await supabase.from("tracking_sessions").insert(insertSession);
      if (sessErr && !String(sessErr.message).toLowerCase().includes("duplicate")) {
        console.error("session insert", sessErr);
      }
    }

    // insert event
    await supabase.from("tracking_events").insert({
      clinic_id: site.clinic_id,
      session_id: sessionId,
      type: String(event.type).slice(0, 32),
      url: event.url ?? null,
      title: event.title ?? null,
      referrer: event.referrer ?? null,
      payload: event.payload ?? null,
    });

    return json({ ok: true });
  } catch (err) {
    console.error("tracking-ingest", err);
    return json({ error: String(err) }, 500);
  }
});

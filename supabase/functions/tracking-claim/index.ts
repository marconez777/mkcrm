// Try to claim a tracking session for a lead based on its first inbound message.
// Idempotent: if the lead already has a tracking_session_id, returns ok.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const REF_RX = /\bref[=:]\s*([A-Za-z0-9]{6,32})/i;

// Map raw utm_source/medium to a friendly origin_source value.
function deriveOrigin(s: { utm_source?: string | null; utm_medium?: string | null; first_referrer?: string | null }): string {
  const src = (s.utm_source || "").toLowerCase();
  const med = (s.utm_medium || "").toLowerCase();
  if (med === "cpc" || med === "ppc" || med === "paid") {
    if (src.includes("google")) return "google_ads";
    if (src.includes("facebook") || src.includes("instagram") || src.includes("meta")) return "meta_ads";
    if (src.includes("tiktok")) return "tiktok_ads";
    return "paid";
  }
  if (med === "organic" || (src && !med)) {
    if (src.includes("google")) return "google_organic";
    if (src.includes("instagram")) return "instagram";
    if (src.includes("facebook")) return "facebook";
  }
  const ref = (s.first_referrer || "").toLowerCase();
  if (ref.includes("google.")) return "google_organic";
  if (ref.includes("instagram.")) return "instagram";
  if (ref.includes("facebook.")) return "facebook";
  if (!ref && !src) return "direct";
  return "referral";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  try {
    const { lead_id, ref: refOverride, manual_session_id } = await req.json();
    if (!lead_id) return json({ error: "missing lead_id" }, 400);
    const supabase = sb();

    const { data: lead } = await supabase
      .from("leads")
      .select("id, clinic_id, tracking_session_id, origin_source, origin_confidence")
      .eq("id", lead_id)
      .maybeSingle();
    if (!lead) return json({ error: "lead not found" }, 404);

    // Manual link by secretary
    if (manual_session_id) {
      const { data: sess } = await supabase
        .from("tracking_sessions")
        .select("id, clinic_id, utm_source, utm_medium, first_referrer")
        .eq("id", manual_session_id)
        .eq("clinic_id", lead.clinic_id)
        .maybeSingle();
      if (!sess) return json({ error: "session not found" }, 404);
      const origin = deriveOrigin(sess);
      await supabase.from("leads").update({
        tracking_session_id: sess.id,
        origin_source: origin,
        origin_confidence: "manual",
      }).eq("id", lead.id);
      await supabase.from("tracking_sessions").update({ lead_id: lead.id, claimed_at: new Date().toISOString() }).eq("id", sess.id);
      return json({ ok: true, manual: true, origin });
    }

    // already claimed via tracking
    if (lead.tracking_session_id) return json({ ok: true, already: true });

    let ref: string | null = refOverride ?? null;
    if (!ref) {
      // grab first inbound text messages and search for ref token
      const { data: msgs } = await supabase
        .from("messages")
        .select("content")
        .eq("lead_id", lead.id)
        .eq("from_me", false)
        .not("content", "is", null)
        .order("timestamp", { ascending: true })
        .limit(5);
      for (const m of msgs ?? []) {
        const match = (m.content || "").match(REF_RX);
        if (match) { ref = match[1]; break; }
      }
    }
    if (!ref) return json({ ok: true, no_ref: true });

    // find session by ref prefix (we use first 10 chars of uuid without dashes)
    const { data: sessions } = await supabase
      .from("tracking_sessions")
      .select("id, utm_source, utm_medium, first_referrer")
      .eq("clinic_id", lead.clinic_id)
      .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString())
      .limit(200);

    const target = (sessions ?? []).find((s) => s.id.replace(/-/g, "").toLowerCase().startsWith(ref!.toLowerCase()));
    if (!target) return json({ ok: true, ref, not_found: true });

    const origin = deriveOrigin(target);
    await supabase.from("leads").update({
      tracking_session_id: target.id,
      origin_source: origin,
      origin_confidence: "tracking",
    }).eq("id", lead.id);
    await supabase.from("tracking_sessions").update({ lead_id: lead.id, claimed_at: new Date().toISOString() }).eq("id", target.id);

    return json({ ok: true, ref, session_id: target.id, origin });
  } catch (err) {
    console.error("tracking-claim", err);
    return json({ error: String(err) }, 500);
  }
});

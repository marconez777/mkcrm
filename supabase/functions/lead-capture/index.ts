// Public lead capture endpoint for clinic websites (WP, HTML, React).
// Accepts POST with a tracking_sites.ingest_token and creates/merges a lead.
// CORS-open, no JWT. The lead_created trigger then enqueues automation emails.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-site-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

function normEmail(e: unknown): string | null {
  if (typeof e !== "string") return null;
  const v = e.trim().toLowerCase();
  if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  if (v.length > 254) return null;
  return v;
}
function normPhone(p: unknown): string | null {
  if (typeof p !== "string") return null;
  const digits = p.replace(/\D+/g, "");
  if (digits.length < 8 || digits.length > 20) return null;
  return digits;
}
function clamp(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const v = s.trim();
  if (!v) return null;
  return v.slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: true }); }

  // Honeypot: silently succeed if filled
  if (body._hp || body.honeypot) return json({ ok: true, ignored: true });

  const siteToken: string | undefined = body.siteToken ?? req.headers.get("x-site-token") ?? undefined;
  if (!siteToken || typeof siteToken !== "string") return json({ ok: false, error: "missing siteToken" }, 400);

  const email = normEmail(body.email);
  const phone = normPhone(body.phone);
  if (!email && !phone) return json({ ok: false, error: "email or phone required" }, 400);

  const name = clamp(body.name, 120);
  const tagsRaw: unknown = body.tags;
  const extraTags = Array.isArray(tagsRaw)
    ? tagsRaw.filter((t) => typeof t === "string").map((t) => (t as string).slice(0, 40)).slice(0, 10)
    : [];
  const customFields = body.customFields && typeof body.customFields === "object" && !Array.isArray(body.customFields)
    ? body.customFields : {};
  const source = clamp(body.source, 40) ?? "site";
  const sessionId: string | null = typeof body.sessionId === "string" && body.sessionId.length < 64 ? body.sessionId : null;

  try {
    const supabase = sb();

    // Resolve site
    const { data: site } = await supabase
      .from("tracking_sites")
      .select("id, clinic_id, domain")
      .eq("ingest_token", siteToken)
      .maybeSingle();
    if (!site) return json({ ok: false, error: "invalid token" }, 401);

    // Try to fetch tracking session for attribution
    let sess: any = null;
    if (sessionId) {
      const { data } = await supabase
        .from("tracking_sessions")
        .select("id, clinic_id, utm_source, utm_medium, first_referrer")
        .eq("id", sessionId)
        .eq("clinic_id", site.clinic_id)
        .maybeSingle();
      sess = data;
    }
    const origin = sess ? deriveOrigin(sess) : "site";

    // Dedup: look for existing lead with same email or phone in this clinic
    let existing: any = null;
    if (email) {
      const { data } = await supabase.from("leads")
        .select("id, tags, custom_fields")
        .eq("clinic_id", site.clinic_id)
        .eq("email", email)
        .maybeSingle();
      existing = data;
    }
    if (!existing && phone) {
      const { data } = await supabase.from("leads")
        .select("id, tags, custom_fields")
        .eq("clinic_id", site.clinic_id)
        .eq("phone", phone)
        .maybeSingle();
      existing = data;
    }

    const baseTags = Array.from(new Set(["site", `source:${source}`, ...extraTags]));

    if (existing) {
      const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...baseTags]));
      const mergedFields = { ...(existing.custom_fields ?? {}), ...customFields };
      const patch: Record<string, unknown> = {
        tags: mergedTags,
        custom_fields: mergedFields,
      };
      if (name) patch.name = name;
      if (email) patch.email = email;
      if (sess?.id) {
        patch.tracking_session_id = sess.id;
        patch.origin_source = origin;
        patch.origin_confidence = "form";
      }
      await supabase.from("leads").update(patch).eq("id", existing.id);
      if (sess?.id) {
        await supabase.from("tracking_sessions")
          .update({ lead_id: existing.id, claimed_at: new Date().toISOString() })
          .eq("id", sess.id);
      }
      return json({ ok: true, lead_id: existing.id, merged: true });
    }

    const insert: Record<string, unknown> = {
      clinic_id: site.clinic_id,
      phone: phone ?? "",
      email,
      name,
      tags: baseTags,
      custom_fields: customFields,
      origin_source: origin,
      origin_confidence: "form",
    };
    if (sess?.id) insert.tracking_session_id = sess.id;

    const { data: created, error: insErr } = await supabase
      .from("leads")
      .insert(insert)
      .select("id")
      .single();
    if (insErr) {
      console.error("lead insert", insErr);
      return json({ ok: false, error: "insert failed" }, 500);
    }

    if (sess?.id) {
      await supabase.from("tracking_sessions")
        .update({ lead_id: created.id, claimed_at: new Date().toISOString() })
        .eq("id", sess.id);
    }

    return json({ ok: true, lead_id: created.id });
  } catch (e) {
    console.error("lead-capture", e);
    return json({ ok: false, error: "internal" }, 500);
  }
});

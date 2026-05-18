// Receives tracking events from the pixel and writes to tracking_visitors / sessions / events.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Tiny in-memory rate limiter: 60 req/min per (ip+clinic)
const rl = new Map<string, { c: number; t: number }>();
function rateLimited(key: string) {
  const now = Date.now();
  const win = 60_000;
  const max = 120;
  const cur = rl.get(key);
  if (!cur || now - cur.t > win) {
    rl.set(key, { c: 1, t: now });
    return false;
  }
  cur.c++;
  return cur.c > max;
}

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseUA(ua: string) {
  const u = ua.toLowerCase();
  let device_type = "desktop";
  if (/mobile|iphone|android.*mobile/.test(u)) device_type = "mobile";
  else if (/ipad|tablet|android(?!.*mobile)/.test(u)) device_type = "tablet";
  let browser = "other";
  if (/edg\//.test(u)) browser = "edge";
  else if (/chrome\//.test(u) && !/edg\//.test(u)) browser = "chrome";
  else if (/firefox\//.test(u)) browser = "firefox";
  else if (/safari\//.test(u) && !/chrome\//.test(u)) browser = "safari";
  let operating_system = "other";
  if (/windows/.test(u)) operating_system = "windows";
  else if (/mac os x|macintosh/.test(u)) operating_system = "macos";
  else if (/android/.test(u)) operating_system = "android";
  else if (/iphone|ipad|ios/.test(u)) operating_system = "ios";
  else if (/linux/.test(u)) operating_system = "linux";
  return { device_type, browser, operating_system };
}

function originHost(origin: string | null): string | null {
  if (!origin) return null;
  try { return new URL(origin).hostname; } catch { /* fallthrough */ }
  // Bare hostname fallback
  const cleaned = origin.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return cleaned || null;
}

function toHost(entry: string): string | null {
  if (!entry) return null;
  const s = entry.trim();
  try { return new URL(s).hostname; } catch { /* fallthrough */ }
  return s.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;
}

function isOriginAllowed(allowed: string[], host: string | null): boolean {
  if (!host) return false;
  if (!allowed || allowed.length === 0) return true; // permissive if not configured
  const hosts = allowed.map(toHost).filter(Boolean) as string[];
  return hosts.some((d) => d === host || host.endsWith("." + d));
}

async function isInternalAuthorized(req: Request, clinicId: string) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return false;

  const userId = userData.user.id;
  const [{ data: superRow }, { data: memberRow }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle(),
    supabase.from("clinic_members").select("clinic_id, role").eq("user_id", userId).eq("clinic_id", clinicId).maybeSingle(),
  ]);

  return !!superRow || (memberRow?.clinic_id === clinicId && (memberRow?.role === "owner" || memberRow?.role === "admin"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const events = Array.isArray(body) ? body : [body];
  if (events.length === 0 || events.length > 50) {
    return new Response(JSON.stringify({ error: "bad_batch" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rawOrigin = req.headers.get("Origin") || req.headers.get("Referer");
  const host = originHost(rawOrigin);
  const projectId = events[0]?.project_id;

  if (!projectId || typeof projectId !== "string") {
    return new Response(JSON.stringify({ error: "missing_project_id" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Resolve clinic + config
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, settings")
    .eq("slug", projectId)
    .maybeSingle();
  if (!clinic) {
    return new Response(JSON.stringify({ error: "unknown_project" }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const tcfg = ((clinic.settings as any)?.tracking) || {};
  if (tcfg.enabled === false) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const allowed = tcfg.allowed_domains || [];
  const originAllowed = isOriginAllowed(allowed, host);
  const internalAuthorized = !originAllowed ? await isInternalAuthorized(req, clinic.id) : false;
  if (!originAllowed && !internalAuthorized) {
    return new Response(JSON.stringify({ error: "origin_not_allowed", host, allowed }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0.0.0.0";
  const rlKey = `${clinic.id}:${ip}`;
  if (rateLimited(rlKey)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const ipHash = await sha256Hex(`${clinic.id}|${ip}`);

  // Process events
  const visitorRows = new Map<string, any>();
  const sessionRows = new Map<string, any>();
  const eventRows: any[] = [];

  for (const ev of events) {
    if (!ev?.visitor_id || !ev?.event_id || !ev?.event_name) continue;
    const ua = String(ev.user_agent || req.headers.get("user-agent") || "");
    const dev = parseUA(ua);
    const now = ev.event_time ? new Date(ev.event_time).toISOString() : new Date().toISOString();

    // visitor (collapse: keep last write per visitor in this batch)
    visitorRows.set(ev.visitor_id, {
      clinic_id: clinic.id,
      visitor_id: ev.visitor_id,
      last_seen_at: now,
      first_landing_page: ev.page_url || null,
      first_referrer: ev.referrer || null,
      first_source: ev.utm_source || null,
      first_medium: ev.utm_medium || null,
      first_campaign: ev.utm_campaign || null,
      device_type: dev.device_type,
      browser: dev.browser,
      operating_system: dev.operating_system,
    });

    if (ev.session_id) {
      sessionRows.set(ev.session_id, {
        clinic_id: clinic.id,
        session_id: ev.session_id,
        visitor_id: ev.visitor_id,
        started_at: now,
        landing_page: ev.page_url || null,
        referrer: ev.referrer || null,
        source: ev.utm_source || null,
        medium: ev.utm_medium || null,
        campaign: ev.utm_campaign || null,
        utm_content: ev.utm_content || null,
        utm_term: ev.utm_term || null,
        gclid: ev.gclid || null,
        fbclid: ev.fbclid || null,
        msclkid: ev.msclkid || null,
        gbraid: ev.gbraid || null,
        wbraid: ev.wbraid || null,
        device_type: dev.device_type,
        browser: dev.browser,
        operating_system: dev.operating_system,
        ip_hash: ipHash,
        user_agent: ua.slice(0, 500),
      });
    }

    eventRows.push({
      clinic_id: clinic.id,
      event_id: ev.event_id,
      visitor_id: ev.visitor_id,
      session_id: ev.session_id || null,
      event_name: String(ev.event_name).slice(0, 100),
      event_type: String(ev.event_type || "custom").slice(0, 50),
      event_time: now,
      page_url: ev.page_url || null,
      page_path: ev.page_path || null,
      page_title: ev.page_title ? String(ev.page_title).slice(0, 500) : null,
      referrer: ev.referrer || null,
      properties: ev.properties || {},
    });
  }

  // 1) Visitors: upsert WITHOUT clobbering first_* fields on conflict.
  //    Strategy: insert new; on conflict, only bump last_seen_at + device fields.
  for (const v of visitorRows.values()) {
    // Try insert (treats as new). If exists, update only last_seen_at + device fields.
    const { error: insErr } = await supabase
      .from("tracking_visitors")
      .insert(v);
    if (insErr) {
      await supabase
        .from("tracking_visitors")
        .update({
          last_seen_at: v.last_seen_at,
          device_type: v.device_type,
          browser: v.browser,
          operating_system: v.operating_system,
        })
        .eq("clinic_id", v.clinic_id)
        .eq("visitor_id", v.visitor_id);
    }
  }

  // 2) Sessions: insert; ignore conflicts (existing session stays).
  if (sessionRows.size > 0) {
    const { error: sErr } = await supabase
      .from("tracking_sessions")
      .upsert(Array.from(sessionRows.values()), {
        onConflict: "clinic_id,session_id",
        ignoreDuplicates: true,
      });
    if (sErr) console.log("[tracking-event] sessions_insert_error", sErr);
  }

  // 3) Events: insert with idempotency on (clinic_id, event_id).
  if (eventRows.length > 0) {
    const { error: eErr } = await supabase
      .from("tracking_events")
      .upsert(eventRows, { onConflict: "clinic_id,event_id", ignoreDuplicates: true });
    if (eErr) {
      console.log("[tracking-event] events_insert_error", eErr);
    } else {
      console.log("[tracking-event] events_inserted", { clinic_id: clinic.id, count: eventRows.length, names: eventRows.map(e => e.event_name) });
    }
  }

  return new Response(JSON.stringify({ ok: true, received: eventRows.length }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

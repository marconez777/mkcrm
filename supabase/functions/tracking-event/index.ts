// Receives tracking events from the pixel and writes to tracking_visitors / sessions / events.
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTrafficSource } from "../_shared/attribution.ts";

function corsFor(req: Request) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

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

// ============ Traffic source normalization rules (cached per instance) ============
type Rule = {
  match_type: 'exact' | 'contains';
  input_source: string | null;
  input_medium: string | null;
  normalized_source: string | null;
  normalized_medium: string | null;
  channel_group: string | null;
  priority: number;
};
const ruleCacheByClinic = new Map<string, { rules: Rule[]; stamp: number }>();
const RULE_CACHE_TTL_MS = 5 * 60 * 1000;

async function getRulesForClinic(clinic_id: string): Promise<Rule[]> {
  const cached = ruleCacheByClinic.get(clinic_id);
  if (cached && Date.now() - cached.stamp < RULE_CACHE_TTL_MS) return cached.rules;
  const { data, error } = await supabase
    .from('traffic_source_rules')
    .select('match_type, input_source, input_medium, normalized_source, normalized_medium, channel_group, priority')
    .or(`clinic_id.is.null,clinic_id.eq.${clinic_id}`)
    .eq('active', true)
    .order('priority', { ascending: true });
  if (error) {
    console.error('[tracking-event] failed loading rules', error.message);
    return cached?.rules ?? [];
  }
  const rules = (data || []) as Rule[];
  ruleCacheByClinic.set(clinic_id, { rules, stamp: Date.now() });
  return rules;
}

function applyRules(
  source: string | null | undefined,
  medium: string | null | undefined,
  rules: Rule[],
): { source: string | null; medium: string | null; channel_group: string | null } | null {
  const src = source ? String(source).toLowerCase() : null;
  const med = medium ? String(medium).toLowerCase() : null;
  for (const r of rules) {
    const inSrc = r.input_source?.toLowerCase() || null;
    const inMed = r.input_medium?.toLowerCase() || null;
    if (!inSrc && !inMed) continue;

    const matches = (value: string | null, target: string | null): boolean => {
      if (!target) return true; // rule does not constrain this field
      if (!value) return false;
      return r.match_type === 'exact' ? value === target : value.includes(target);
    };

    if (matches(src, inSrc) && matches(med, inMed)) {
      return {
        source: r.normalized_source ?? source ?? null,
        medium: r.normalized_medium ?? medium ?? null,
        channel_group: r.channel_group ?? null,
      };
    }
  }
  return null;
}

const BOT_UA_RE = /lovable|headlesschrome|prerender|phantomjs|puppeteer|playwright|\bbot\b|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|twitterbot|linkedinbot|googlebot|bingbot|yandex|duckduckbot|baiduspider|applebot|semrush|ahrefs|mj12bot|dotbot|pingdom|uptimerobot|gtmetrix|lighthouse|chrome-lighthouse|petalbot|seznambot|sogou|exabot|ia_archiver|archive\.org/i;
function isBotUA(ua: string): boolean {
  if (!ua) return true;
  return BOT_UA_RE.test(ua);
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
  if (!allowed || allowed.length === 0) return false; // strict: must whitelist domains
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
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const events = Array.isArray(body) ? body : [body];
  if (events.length === 0 || events.length > 50) {
    return new Response(JSON.stringify({ error: "bad_batch" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawOrigin = req.headers.get("Origin") || req.headers.get("Referer");
  const host = originHost(rawOrigin);
  const projectId = events[0]?.project_id;

  if (!projectId || typeof projectId !== "string") {
    return new Response(JSON.stringify({ error: "missing_project_id" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const tcfg = ((clinic.settings as any)?.tracking) || {};
  if (tcfg.enabled === false) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const allowed = tcfg.allowed_domains || [];
  const originAllowed = isOriginAllowed(allowed, host);
  const internalAuthorized = !originAllowed ? await isInternalAuthorized(req, clinic.id) : false;
  if (!originAllowed && !internalAuthorized) {
    return new Response(JSON.stringify({ error: "origin_not_allowed", host, allowed }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0.0.0.0";
  const rlKey = `${clinic.id}:${ip}`;
  if (rateLimited(rlKey)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ipHash = await sha256Hex(`${clinic.id}|${ip}`);

  // Process events
  const visitorRows = new Map<string, any>();
  const sessionRows = new Map<string, any>();
  const eventRows: any[] = [];

  const rules = await getRulesForClinic(clinic.id);

  for (const ev of events) {
    if (!ev?.visitor_id || !ev?.event_id || !ev?.event_name) continue;
    const ua = String(ev.user_agent || req.headers.get("user-agent") || "");
    const dev = parseUA(ua);
    const now = ev.event_time ? new Date(ev.event_time).toISOString() : new Date().toISOString();

    const attr = resolveTrafficSource({
      utm_source: ev.utm_source, utm_medium: ev.utm_medium, utm_campaign: ev.utm_campaign,
      utm_content: ev.utm_content, utm_term: ev.utm_term,
      gclid: ev.gclid, gbraid: ev.gbraid, wbraid: ev.wbraid,
      fbclid: ev.fbclid, fbp: ev.fbp, fbc: ev.fbc,
      ttclid: ev.ttclid, msclkid: ev.msclkid, li_fat_id: ev.li_fat_id,
      referrer: ev.referrer,
    });

    // Normalization rules (variations → canonical source/medium/channel_group).
    // Does NOT modify raw_params; raw input is preserved.
    const ruleMatch = applyRules(attr.source, attr.medium, rules);
    if (ruleMatch) {
      if (ruleMatch.source) attr.source = ruleMatch.source;
      if (ruleMatch.medium) attr.medium = ruleMatch.medium;
      if (ruleMatch.channel_group) attr.channel_group = ruleMatch.channel_group;
    }



    // visitor (collapse: keep last write per visitor in this batch)
    visitorRows.set(ev.visitor_id, {
      clinic_id: clinic.id,
      visitor_id: ev.visitor_id,
      last_seen_at: now,
      first_landing_page: ev.page_url || null,
      first_referrer: ev.referrer || null,
      first_source: attr.source,
      first_medium: attr.medium,
      first_campaign: attr.campaign,
      device_type: dev.device_type,
      browser: dev.browser,
      operating_system: dev.operating_system,
      __attr: attr,
    });

    if (ev.session_id) {
      sessionRows.set(ev.session_id, {
        clinic_id: clinic.id,
        session_id: ev.session_id,
        visitor_id: ev.visitor_id,
        started_at: now,
        landing_page: ev.page_url || null,
        referrer: ev.referrer || null,
        source: attr.source,
        medium: attr.medium,
        campaign: attr.campaign,
        utm_content: attr.content,
        utm_term: attr.term,
        channel_group: attr.channel_group,
        confidence_score: attr.confidence_score,
        attribution_reason: attr.attribution_reason,
        gclid: ev.gclid || null,
        fbclid: ev.fbclid || null,
        msclkid: ev.msclkid || null,
        gbraid: ev.gbraid || null,
        wbraid: ev.wbraid || null,
        fbp: ev.fbp ?? null,
        fbc: ev.fbc ?? null,
        ttclid: ev.ttclid ?? null,
        li_fat_id: ev.li_fat_id ?? null,
        raw_querystring: ev.raw_querystring ?? null,
        raw_referrer: ev.raw_referrer ?? null,
        raw_params: ev.raw_params ?? null,
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
  //    Strategy: insert new; on conflict, only bump last_* + device fields.
  for (const v of visitorRows.values()) {
    const attr = v.__attr;
    const nowIso = v.last_seen_at;
    // strip helper field
    const { __attr, ...vRow } = v;

    const insertRow: Record<string, any> = {
      ...vRow,
      last_source: attr.source,
      last_medium: attr.medium,
      last_campaign: attr.campaign,
      last_channel_group: attr.channel_group,
      last_seen_attribution_at: nowIso,
    };
    if (attr.source !== "direct") {
      insertRow.last_non_direct_source = attr.source;
      insertRow.last_non_direct_medium = attr.medium;
      insertRow.last_non_direct_campaign = attr.campaign;
      insertRow.last_non_direct_channel_group = attr.channel_group;
      insertRow.last_non_direct_at = nowIso;
    }

    const { error: insErr } = await supabase
      .from("tracking_visitors")
      .insert(insertRow);
    if (insErr) {
      const updatePayload: Record<string, any> = {
        last_seen_at: nowIso,
        device_type: v.device_type,
        browser: v.browser,
        operating_system: v.operating_system,
        last_source: attr.source,
        last_medium: attr.medium,
        last_campaign: attr.campaign,
        last_channel_group: attr.channel_group,
        last_seen_attribution_at: nowIso,
      };
      if (attr.source !== "direct") {
        updatePayload.last_non_direct_source = attr.source;
        updatePayload.last_non_direct_medium = attr.medium;
        updatePayload.last_non_direct_campaign = attr.campaign;
        updatePayload.last_non_direct_channel_group = attr.channel_group;
        updatePayload.last_non_direct_at = nowIso;
      }
      await supabase
        .from("tracking_visitors")
        .update(updatePayload)
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

  // 2.5) Resolve visitor → lead from tracking_identity_links and stamp lead_id on events.
  //      Also bump leads.last_activity_at for any leads that received events.
  const uniqueVisitors = Array.from(new Set(eventRows.map((e) => e.visitor_id)));
  if (uniqueVisitors.length > 0) {
    const { data: links } = await supabase
      .from("tracking_identity_links")
      .select("visitor_id, lead_id, linked_at")
      .eq("clinic_id", clinic.id)
      .in("visitor_id", uniqueVisitors);

    if (links && links.length > 0) {
      // If a visitor has multiple links, prefer the most recent one.
      const visitorToLead = new Map<string, string>();
      const linkedAtByVisitor = new Map<string, string>();
      for (const l of links) {
        const prev = linkedAtByVisitor.get(l.visitor_id);
        if (!prev || String(l.linked_at) > prev) {
          visitorToLead.set(l.visitor_id, l.lead_id);
          linkedAtByVisitor.set(l.visitor_id, String(l.linked_at));
        }
      }
      const affectedLeads = new Set<string>();
      for (const ev of eventRows) {
        const leadId = visitorToLead.get(ev.visitor_id);
        if (leadId) {
          ev.lead_id = leadId;
          affectedLeads.add(leadId);
        }
      }
      if (affectedLeads.size > 0) {
        await supabase
          .from("leads")
          .update({ last_site_activity_at: new Date().toISOString() })
          .in("id", Array.from(affectedLeads))
          .eq("clinic_id", clinic.id);
      }
    }
  }

  // 3) Events: insert with idempotency on (clinic_id, event_id).
  if (eventRows.length > 0) {
    const { error: eErr } = await supabase
      .from("tracking_events")
      .upsert(eventRows, { onConflict: "clinic_id,event_id", ignoreDuplicates: true });
    if (eErr) {
      console.log("[tracking-event] events_insert_error", eErr);
    }
  }

  return new Response(JSON.stringify({ ok: true, received: eventRows.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

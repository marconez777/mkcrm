// Links an anonymous visitor_id to a lead_id and backfills past events with that lead_id.
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

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function originHost(origin: string | null): string | null {
  if (!origin) return null;
  try { return new URL(origin).hostname; } catch { /* */ }
  return origin.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;
}
function toHost(entry: string): string | null {
  if (!entry) return null;
  const s = entry.trim();
  try { return new URL(s).hostname; } catch { /* */ }
  return s.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;
}
function isOriginAllowed(allowed: string[], host: string | null): boolean {
  if (!host) return false;
  if (!allowed || allowed.length === 0) return true;
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
  return !!superRow || (memberRow?.clinic_id === clinicId);
}

function safeProps(p: any): Record<string, unknown> {
  if (!p || typeof p !== "object") return {};
  const out: Record<string, unknown> = {};
  const banned = /(email|phone|telefone|cpf|mensagem|message|password|senha|diagnost|sintom|resposta|answer)/i;
  for (const [k, v] of Object.entries(p)) {
    if (banned.test(k)) continue;
    if (typeof v === "string" && v.length > 500) out[k] = v.slice(0, 500);
    else out[k] = v;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { project_id, visitor_id, session_id, lead_id, email, phone, whatsapp_id, source_event, properties } = body || {};
  const rawOrigin = req.headers.get("Origin") || req.headers.get("Referer");
  const host = originHost(rawOrigin);
  console.log("[tracking-identify] received", { project_id, visitor_id, lead_id, source_event, host });

  if (!project_id || !visitor_id) {
    return new Response(JSON.stringify({ error: "missing_required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: clinic } = await supabase
    .from("clinics").select("id, settings").eq("slug", project_id).maybeSingle();
  if (!clinic) {
    return new Response(JSON.stringify({ error: "unknown_project" }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const tcfg = ((clinic.settings as any)?.tracking) || {};
  const allowed = tcfg.allowed_domains || [];
  const originAllowed = isOriginAllowed(allowed, host);
  const internalAuthorized = !originAllowed ? await isInternalAuthorized(req, clinic.id) : false;
  if (!originAllowed && !internalAuthorized) {
    console.log("[tracking-identify] origin_blocked", { host, allowed });
    return new Response(JSON.stringify({ error: "origin_not_allowed", host }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Resolve lead_id: if not provided, try lookup by email/phone within the clinic.
  let resolvedLeadId: string | null = lead_id || null;
  if (!resolvedLeadId && (email || phone)) {
    const q = supabase.from("leads").select("id").eq("clinic_id", clinic.id).limit(1);
    if (email) q.ilike("email", email.trim());
    else if (phone) q.eq("phone", String(phone).replace(/\D/g, ""));
    const { data: leadRow } = await q.maybeSingle();
    if (leadRow?.id) resolvedLeadId = leadRow.id;
  }

  if (!resolvedLeadId) {
    return new Response(JSON.stringify({ error: "lead_not_resolved" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const email_hash = email ? await sha256Hex(String(email)) : null;
  const phone_hash = phone ? await sha256Hex(String(phone).replace(/\D/g, "")) : null;

  // Upsert link (unique on clinic_id+visitor_id+lead_id)
  const { error: linkErr } = await supabase
    .from("tracking_identity_links")
    .upsert({
      clinic_id: clinic.id,
      visitor_id,
      lead_id: resolvedLeadId,
      email_hash,
      phone_hash,
      whatsapp_id: whatsapp_id || null,
      link_source: source_event || "manual",
      linked_at: new Date().toISOString(),
    }, { onConflict: "clinic_id,visitor_id,lead_id" });
  if (linkErr) console.log("[tracking-identify] link_error", linkErr);

  // Backfill past events for this visitor
  const { error: bfErr } = await supabase
    .from("tracking_events")
    .update({ lead_id: resolvedLeadId })
    .eq("clinic_id", clinic.id)
    .eq("visitor_id", visitor_id)
    .is("lead_id", null);
  if (bfErr) console.log("[tracking-identify] backfill_error", bfErr);

  // Insert lead_identified event
  const eventId = `idn_${crypto.randomUUID()}`;
  const { error: evErr } = await supabase.from("tracking_events").insert({
    clinic_id: clinic.id,
    event_id: eventId,
    visitor_id,
    session_id: session_id || null,
    lead_id: resolvedLeadId,
    event_name: "lead_identified",
    event_type: "identity",
    event_time: new Date().toISOString(),
    properties: { ...safeProps(properties), source_event: source_event || null, has_email_hash: !!email_hash, has_phone_hash: !!phone_hash },
  });
  if (evErr) console.log("[tracking-identify] event_error", evErr);

  return new Response(JSON.stringify({ ok: true, lead_id: resolvedLeadId }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
});

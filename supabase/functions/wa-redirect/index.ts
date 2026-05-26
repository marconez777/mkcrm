// GET /functions/v1/wa-redirect?p=<slug>&v=<visitor>&s=<session>&to=<phone>&msg=<text>
// Generates a tracking_code, persists whatsapp_intents + tracking_events, redirects to wa.me.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function toHost(s: string | null): string | null {
  if (!s) return null;
  try { return new URL(s).hostname; } catch { /* */ }
  return s.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;
}

function isOriginAllowed(allowed: string[], host: string | null): boolean {
  if (!host || !allowed?.length) return false;
  const hosts = allowed.map(toHost).filter(Boolean) as string[];
  return hosts.some((d) => d === host || host.endsWith("." + d));
}

function genCode(): string {
  // 10-char lowercase hex (e.g. "237e858b97")
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response("method_not_allowed", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get("p");
  const visitorId = url.searchParams.get("v");
  const sessionId = url.searchParams.get("s");
  const toPhoneRaw = url.searchParams.get("to") || "";
  const msgBase = (url.searchParams.get("msg") || "Olá, vim pelo site e gostaria de mais informações.").slice(0, 400);

  const toPhone = toPhoneRaw.replace(/\D/g, "");
  if (!projectId || !toPhone) {
    return new Response("missing_params", { status: 400, headers: corsHeaders });
  }

  const refOrigin = req.headers.get("Origin") || req.headers.get("Referer");
  const host = toHost(refOrigin);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const clinicQuery = supabase.from("clinics").select("id, settings");
  const { data: clinic } = await (isUuid
    ? clinicQuery.or(`id.eq.${projectId},slug.eq.${projectId}`)
    : clinicQuery.eq("slug", projectId)
  ).maybeSingle();
  if (!clinic) {
    return new Response("unknown_project", { status: 404, headers: corsHeaders });
  }

  // NOTE: allowed_domains check intentionally removed for wa-redirect.
  // Public link by nature (anyone with the URL can hit it). Browsers strip Referer
  // on cross-origin navigations (rel="noopener noreferrer", strict referrer policies),
  // so checking host here causes legitimate clicks to be blocked.
  // Origin validation remains enforced on tracking-pixel and tracking-identify.
  const _refHostForAudit = host;

  // Generate unique code (retry up to 5 times on collision)
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = genCode();
    const { data: existing } = await supabase
      .from("whatsapp_intents").select("id")
      .eq("clinic_id", clinic.id).eq("tracking_code", code).maybeSingle();
    if (!existing) break;
    code = "";
  }
  if (!code) {
    return new Response("code_generation_failed", { status: 500, headers: corsHeaders });
  }

  // Resolve session attribution (best-effort)
  let source: string | null = null, medium: string | null = null, campaign: string | null = null;
  let utm_content: string | null = null, utm_term: string | null = null, landing_page: string | null = null;
  if (sessionId) {
    const { data: sess } = await supabase
      .from("tracking_sessions")
      .select("source, medium, campaign, utm_content, utm_term, landing_page, referrer")
      .eq("clinic_id", clinic.id).eq("session_id", sessionId).maybeSingle();
    if (sess) {
      source = sess.source; medium = sess.medium; campaign = sess.campaign;
      utm_content = sess.utm_content; utm_term = sess.utm_term; landing_page = sess.landing_page;
    }
  }

  await supabase.from("whatsapp_intents").insert({
    clinic_id: clinic.id,
    visitor_id: visitorId || null,
    session_id: sessionId || null,
    tracking_code: code,
    phone_destination: toPhone,
    source, medium, campaign, utm_content, utm_term,
    landing_page,
    referrer: req.headers.get("Referer") || null,
    user_agent: req.headers.get("User-Agent") || null,
    status: "pending",
  });

  if (visitorId) {
    await supabase.from("tracking_events").insert({
      clinic_id: clinic.id,
      event_id: `wr_${crypto.randomUUID()}`,
      visitor_id: visitorId,
      session_id: sessionId || null,
      event_name: "whatsapp_redirect",
      event_type: "custom",
      event_time: new Date().toISOString(),
      page_url: req.headers.get("Referer") || null,
      properties: { tracking_code: code, phone_destination: toPhone },
    });
  }

  const text = `${msgBase}\n\n---\n*Mantenha esse código na sua mensagem para entrar na fila de atendimento:*\n(ref=${code})`;
  const dest = `https://wa.me/${toPhone}?text=${encodeURIComponent(text)}`;
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: dest } });
});

// Returns public tracking config for a given project_id (clinic slug).
import { createClient } from "npm:@supabase/supabase-js@2";

function corsFor(req: Request) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const projectId = url.searchParams.get("project_id");
  if (!projectId) {
    return new Response(JSON.stringify({ enabled: false, error: "missing_project_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const clinicQuery = supabase.from("clinics").select("settings");
  const { data } = await (isUuid
    ? clinicQuery.or(`id.eq.${projectId},slug.eq.${projectId}`)
    : clinicQuery.eq("slug", projectId)
  ).maybeSingle();

  const t = (data?.settings as any)?.tracking || {};
  return new Response(
    JSON.stringify({
      enabled: t.enabled !== false,
      session_timeout_minutes: t.session_timeout_minutes || 30,
      consent_required: t.consent_required === true,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    },
  );
});

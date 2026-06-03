import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data?.user?.id ?? null;
    }
    let clinicId: string | null = null;
    if (userId) {
      const { data: m } = await admin.from("clinic_members").select("clinic_id").eq("user_id", userId).limit(1).maybeSingle();
      clinicId = m?.clinic_id ?? null;
    }

    const body = await req.json().catch(() => ({}));
    const errorMessage = String(body.error_message ?? "Unknown error").slice(0, 2000);
    const errorStack = body.error_stack ? String(body.error_stack).slice(0, 8000) : null;
    const route = body.route ? String(body.route).slice(0, 256) : null;
    const severity = ["info", "warn", "error", "fatal"].includes(body.severity) ? body.severity : "error";
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    await admin.from("error_events").insert({
      clinic_id: clinicId,
      user_id: userId,
      surface: "frontend",
      route,
      error_message: errorMessage,
      error_stack: errorStack,
      severity,
      metadata,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("log-frontend-error error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

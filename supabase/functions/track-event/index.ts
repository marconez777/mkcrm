import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Aceita { events: [{ feature, action, entity_id?, metadata? }, ...] }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Resolve clinic_id atual do usuário
    const { data: member } = await admin
      .from("clinic_members")
      .select("clinic_id")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle();

    const body = await req.json().catch(() => ({}));
    const events = Array.isArray(body.events) ? body.events : [body];
    if (events.length === 0 || events.length > 200) {
      return new Response(JSON.stringify({ error: "Batch inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rows = events
      .filter((e: any) => e && typeof e.feature === "string" && typeof e.action === "string")
      .slice(0, 200)
      .map((e: any) => ({
        clinic_id: member?.clinic_id ?? null,
        user_id: userData.user!.id,
        feature: String(e.feature).slice(0, 64),
        action: String(e.action).slice(0, 64),
        entity_id: e.entity_id ? String(e.entity_id).slice(0, 128) : null,
        metadata: e.metadata && typeof e.metadata === "object" ? e.metadata : {},
      }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error } = await admin.from("feature_events").insert(rows);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("track-event error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

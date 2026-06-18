import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { data: superRow } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "super_admin").maybeSingle();
    if (!superRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const clinicId = url.searchParams.get("clinic_id");
    const term = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(50, Number(url.searchParams.get("limit") ?? "20"));

    let q = admin.from("leads").select("id, name, phone, clinic_id, stage_id").limit(limit);
    if (clinicId) q = q.eq("clinic_id", clinicId);
    if (term) {
      const safe = term.replace(/[,()*]/g, " ");
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)) {
        q = q.eq("id", term);
      } else {
        q = q.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
      }
    }
    q = q.order("updated_at", { ascending: false });
    const { data, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ leads: data ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

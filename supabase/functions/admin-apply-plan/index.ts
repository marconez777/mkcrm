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

    const body = await req.json().catch(() => ({}));
    const planCode = body.plan_code as string;
    const clinicIds = (body.clinic_ids as string[]) ?? [];
    const overwriteFeatures = body.overwrite_features !== false;
    const overwriteLimits = body.overwrite_limits !== false;

    if (!planCode || clinicIds.length === 0) {
      return new Response(JSON.stringify({ error: "plan_code e clinic_ids obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: plan } = await admin.from("plans").select("*").eq("code", planCode).maybeSingle();
    if (!plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: clinics } = await admin.from("clinics").select("id, settings").in("id", clinicIds);
    for (const c of clinics ?? []) {
      const settings: any = c.settings ?? {};
      if (overwriteFeatures) settings.features = plan.features ?? {};
      if (overwriteLimits) settings.limits = plan.limits ?? {};
      await admin.from("clinics").update({ plan: planCode, settings }).eq("id", c.id);
    }

    return new Response(JSON.stringify({ ok: true, applied: clinics?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("admin-apply-plan error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

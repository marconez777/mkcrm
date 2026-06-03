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
    const clinicId = body.clinic_id as string;
    const fallbackCode = (body.fallback_plan_code as string) ?? "starter";
    const reason = (body.reason as string) ?? "Revogado pelo super admin";
    if (!clinicId) {
      return new Response(JSON.stringify({ error: "clinic_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: fallback } = await admin.from("plans").select("id, features, limits").eq("code", fallbackCode).maybeSingle();
    if (!fallback) {
      return new Response(JSON.stringify({ error: "fallback_plan_code inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin
      .from("clinic_subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString(), is_current: false, grant_reason: reason })
      .eq("clinic_id", clinicId)
      .eq("is_current", true);

    await admin.from("clinic_subscriptions").insert({
      clinic_id: clinicId,
      plan_id: fallback.id,
      status: "past_due",
      source: "manual",
      granted_by: userData.user.id,
      grant_reason: `Fallback após revogação: ${reason}`,
      is_current: true,
    });

    await admin.from("clinics").update({
      plan_id: fallback.id,
      settings: { features: fallback.features ?? {}, limits: fallback.limits ?? {} },
    }).eq("id", clinicId);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("admin-revoke-plan error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

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
    const trialDays = Number.isFinite(body.trial_days) ? Number(body.trial_days) : null;
    const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;
    const grantReason = (body.grant_reason as string) ?? null;
    const status = (body.status as string) ?? (trialDays && trialDays > 0 ? "trialing" : "manual_grant");

    if (!planCode || clinicIds.length === 0) {
      return new Response(JSON.stringify({ error: "plan_code e clinic_ids obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: plan } = await admin.from("plans").select("*").eq("code", planCode).maybeSingle();
    if (!plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const trialEndsAt = trialDays && trialDays > 0
      ? new Date(Date.now() + trialDays * 86400000).toISOString()
      : null;

    const { data: clinics } = await admin.from("clinics").select("id, settings").in("id", clinicIds);
    for (const c of clinics ?? []) {
      const settings: any = c.settings ?? {};
      if (overwriteFeatures) settings.features = plan.features ?? {};
      if (overwriteLimits) settings.limits = plan.limits ?? {};
      await admin.from("clinics").update({ plan_id: plan.id, settings }).eq("id", c.id);

      // Encerra subscription corrente
      await admin
        .from("clinic_subscriptions")
        .update({ is_current: false, canceled_at: new Date().toISOString() })
        .eq("clinic_id", c.id)
        .eq("is_current", true);

      // Cria nova subscription manual
      await admin.from("clinic_subscriptions").insert({
        clinic_id: c.id,
        plan_id: plan.id,
        status,
        source: "manual",
        trial_ends_at: trialEndsAt,
        cancel_at: expiresAt,
        granted_by: userData.user.id,
        grant_reason: grantReason,
        is_current: true,
      });
    }

    return new Response(JSON.stringify({ ok: true, applied: clinics?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("admin-apply-plan error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

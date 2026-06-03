import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Migra subscriptions manual_grant/trialing com cancel_at/trial_ends_at vencido
// para o plano default (starter) com status past_due.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date().toISOString();

    const { data: fallback } = await admin.from("plans").select("id, features, limits").eq("code", "starter").maybeSingle();
    if (!fallback) return new Response(JSON.stringify({ error: "fallback ausente" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Expira por cancel_at (manual_grant com prazo) e trial_ends_at (trialing)
    const { data: expired } = await admin
      .from("clinic_subscriptions")
      .select("id, clinic_id")
      .eq("is_current", true)
      .or(`and(status.eq.manual_grant,cancel_at.lt.${now}),and(status.eq.trialing,trial_ends_at.lt.${now})`);

    let count = 0;
    for (const s of expired ?? []) {
      await admin.from("clinic_subscriptions").update({ is_current: false, canceled_at: now, status: "canceled" }).eq("id", s.id);
      await admin.from("clinic_subscriptions").insert({
        clinic_id: s.clinic_id,
        plan_id: fallback.id,
        status: "past_due",
        source: "manual",
        grant_reason: "Expiração automática (cron)",
        is_current: true,
      });
      await admin.from("clinics").update({
        plan_id: fallback.id,
        settings: { features: fallback.features ?? {}, limits: fallback.limits ?? {} },
      }).eq("id", s.clinic_id);
      count++;
    }

    return new Response(JSON.stringify({ ok: true, expired: count }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("cron-expire-manual-grants error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

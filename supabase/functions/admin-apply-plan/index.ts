import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: superRow } = await admin.from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "super_admin").maybeSingle();
    if (!superRow) return json({ error: "Forbidden" }, 403);

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
      return json({ error: "plan_code e clinic_ids obrigatórios" }, 400);
    }

    const { data: plan, error: planErr } = await admin.from("plans").select("*").eq("code", planCode).maybeSingle();
    if (planErr) return json({ error: `Falha ao ler plano: ${planErr.message}` }, 500);
    if (!plan) return json({ error: "Plano não encontrado" }, 404);

    const trialEndsAt = trialDays && trialDays > 0
      ? new Date(Date.now() + trialDays * 86400000).toISOString()
      : null;

    const { data: clinics, error: clinicsErr } = await admin
      .from("clinics").select("id, settings").in("id", clinicIds);
    if (clinicsErr) return json({ error: `Falha ao ler clínicas: ${clinicsErr.message}` }, 500);
    if (!clinics || clinics.length === 0) {
      return json({ error: "Nenhuma clínica encontrada para os ids informados" }, 404);
    }

    const errors: { clinic_id: string; step: string; message: string }[] = [];
    let applied = 0;

    for (const c of clinics) {
      const settings: any = { ...(c.settings ?? {}) };
      if (overwriteFeatures) settings.features = plan.features ?? {};
      if (overwriteLimits) settings.limits = plan.limits ?? {};

      const { error: updErr } = await admin
        .from("clinics")
        .update({ plan_id: plan.id, settings })
        .eq("id", c.id);
      if (updErr) {
        errors.push({ clinic_id: c.id, step: "update_clinic", message: updErr.message });
        continue;
      }

      const { error: cancelErr } = await admin
        .from("clinic_subscriptions")
        .update({ is_current: false, canceled_at: new Date().toISOString() })
        .eq("clinic_id", c.id)
        .eq("is_current", true);
      if (cancelErr) {
        errors.push({ clinic_id: c.id, step: "cancel_previous_subscription", message: cancelErr.message });
        continue;
      }

      const { error: insErr } = await admin.from("clinic_subscriptions").insert({
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
      if (insErr) {
        errors.push({ clinic_id: c.id, step: "insert_subscription", message: insErr.message });
        continue;
      }

      // Auditoria
      await admin.from("audit_log").insert({
        actor_user_id: userData.user.id,
        clinic_id: c.id,
        action: "plan.apply",
        entity: "clinic_subscriptions",
        diff: { plan_code: plan.code, status, trial_ends_at: trialEndsAt, cancel_at: expiresAt, grant_reason: grantReason },
      });

      applied += 1;
    }

    if (applied === 0) {
      return json({ error: "Nenhuma clínica foi atualizada", details: errors }, 500);
    }

    return json({ ok: true, applied, total: clinics.length, errors });
  } catch (e: any) {
    console.error("admin-apply-plan error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

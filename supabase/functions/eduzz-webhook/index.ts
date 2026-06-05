// Eduzz Custom Delivery webhook - https://github.com/eduzz/custom-delivery
// Public endpoint (no JWT). Plan code is passed in the URL path:
//   POST /functions/v1/eduzz-webhook/<plan_code>
// Eduzz sends form-urlencoded or JSON with edz_* fields.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(extra: Record<string, unknown> = {}) {
  // Eduzz requires HTTP 200 on success — and we also return 200 on handled errors
  // so they don't keep retrying (we log everything to eduzz_purchases).
  return new Response(JSON.stringify({ ok: true, ...extra }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Constant-time string comparison
function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function parseBody(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return await req.json().catch(() => ({}));
  }
  // Eduzz often sends application/x-www-form-urlencoded
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const out: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(text)) out[k] = v;
    return out;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Extract plan_code from the last path segment
  const url = new URL(req.url);
  const segs = url.pathname.split("/").filter(Boolean);
  const planCode = (segs[segs.length - 1] ?? "").toLowerCase();

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rawBody = await parseBody(req);
  // Eduzz nests data in `fields` sometimes; flatten if needed
  const fields: Record<string, any> = (rawBody.fields && typeof rawBody.fields === "object")
    ? rawBody.fields
    : rawBody;
  const type = String(rawBody.type ?? fields.type ?? "").toLowerCase();

  const fat_cod = fields.edz_fat_cod ? String(fields.edz_fat_cod) : null;
  const cnt_cod = fields.edz_cnt_cod ? String(fields.edz_cnt_cod) : null;
  const cli_email = fields.edz_cli_email ? String(fields.edz_cli_email).trim().toLowerCase() : null;
  const cli_name = fields.edz_cli_rsocial ? String(fields.edz_cli_rsocial) : null;
  const cli_taxnumber = fields.edz_cli_taxnumber ? String(fields.edz_cli_taxnumber) : null;
  const fat_status = fields.edz_fat_status != null ? Number(fields.edz_fat_status) : null;
  const valor = fields.edz_valorpago != null ? Number(fields.edz_valorpago) : null;
  const isOrderBump = fields.edz_order_bump_item === true || String(fields.edz_order_bump_item) === "true";
  const receivedSecret = String(fields.edz_cli_origin_secret ?? "");

  const baseRow = {
    plan_code: planCode,
    fat_cod,
    cnt_cod,
    cli_email,
    cli_name,
    cli_taxnumber,
    type,
    fat_status,
    valor,
    payload: rawBody,
  };

  async function logRow(extra: { clinic_id?: string | null; processed_status: string; error_msg?: string | null }) {
    await admin
      .from("eduzz_purchases")
      .insert({ ...baseRow, ...extra })
      // Idempotency: same fat_cod+cnt_cod+type -> ignore duplicate inserts
      .select()
      .maybeSingle()
      .then(() => {})
      .catch((e) => console.error("eduzz_purchases insert failed", e));
  }

  try {
    // 1) Validate origin secret
    const expectedSecret = Deno.env.get("EDUZZ_ORIGIN_SECRET") ?? "";
    if (!expectedSecret) {
      console.error("EDUZZ_ORIGIN_SECRET not configured");
      await logRow({ processed_status: "error", error_msg: "EDUZZ_ORIGIN_SECRET not configured" });
      return ok({ note: "secret_not_configured" });
    }
    if (!receivedSecret || !safeEq(receivedSecret, expectedSecret)) {
      await logRow({ processed_status: "error", error_msg: "bad_origin_secret" });
      return ok({ note: "bad_secret" });
    }

    // 2) Validate plan code
    if (!planCode) {
      await logRow({ processed_status: "error", error_msg: "missing_plan_code_in_path" });
      return ok({ note: "missing_plan" });
    }
    const { data: plan } = await admin.from("plans").select("id, code").eq("code", planCode).maybeSingle();
    if (!plan) {
      await logRow({ processed_status: "error", error_msg: `invalid_plan_code:${planCode}` });
      return ok({ note: "invalid_plan" });
    }

    // 3) Validate event type
    if (type !== "create" && type !== "remove") {
      await logRow({ processed_status: "ignored", error_msg: `unsupported_type:${type}` });
      return ok({ note: "ignored_type" });
    }

    // 4) Skip order bumps (only main item activates plan)
    if (isOrderBump) {
      await logRow({ processed_status: "ignored", error_msg: "order_bump" });
      return ok({ note: "order_bump_ignored" });
    }

    // 5) Email required
    if (!cli_email) {
      await logRow({ processed_status: "error", error_msg: "missing_email" });
      return ok({ note: "no_email" });
    }

    // 6) For create: require fat_status=3 (Paga)
    if (type === "create" && fat_status !== 3) {
      await logRow({
        processed_status: "ignored",
        error_msg: `not_paid:fat_status=${fat_status}`,
      });
      return ok({ note: "not_paid" });
    }

    // 7) Find existing user/clinic by email
    let clinicId: string | null = null;
    let userId: string | null = null;
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id")
      .eq("email", cli_email)
      .maybeSingle();
    if (profile?.user_id) {
      userId = profile.user_id;
      const { data: member } = await admin
        .from("clinic_members")
        .select("clinic_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (member?.clinic_id) clinicId = member.clinic_id;
    }

    // === REMOVE: revoke plan ===
    if (type === "remove") {
      if (!clinicId) {
        await logRow({ processed_status: "ignored", error_msg: "remove_no_clinic" });
        return ok({ note: "no_clinic_to_remove" });
      }
      const { data: freePlan } = await admin
        .from("plans")
        .select("id, code, features, limits")
        .eq("code", "starter")
        .maybeSingle();
      if (!freePlan) {
        await logRow({ clinic_id: clinicId, processed_status: "error", error_msg: "free_plan_not_found" });
        return ok({ note: "no_free_plan" });
      }
      await applyPlanToClinic(admin, clinicId, freePlan as any, {
        source: "eduzz",
        status: "canceled",
        grant_reason: `eduzz remove ${planCode} fat=${fat_cod}`,
        metadata: { eduzz_fat_cod: fat_cod, eduzz_cnt_cod: cnt_cod, eduzz_event: "remove", plan_revoked: planCode },
      });
      await logRow({ clinic_id: clinicId, processed_status: "ok" });
      return ok({ note: "plan_revoked" });
    }

    // === CREATE: activate plan ===
    const { data: fullPlan } = await admin
      .from("plans")
      .select("id, code, features, limits")
      .eq("id", plan.id)
      .maybeSingle();
    if (!fullPlan) {
      await logRow({ processed_status: "error", error_msg: "plan_load_failed" });
      return ok({ note: "plan_load_failed" });
    }

    if (!clinicId) {
      // Create new auth user + clinic + membership
      const result = await createClinicForNewUser(admin, {
        email: cli_email,
        name: cli_name,
      });
      if (!result.ok) {
        await logRow({ processed_status: "error", error_msg: `signup_failed:${result.error}` });
        return ok({ note: "signup_failed" });
      }
      clinicId = result.clinic_id;
      userId = result.user_id;
    }

    await applyPlanToClinic(admin, clinicId!, fullPlan as any, {
      source: "eduzz",
      status: "active",
      grant_reason: `eduzz purchase ${planCode} fat=${fat_cod}`,
      metadata: {
        eduzz_fat_cod: fat_cod,
        eduzz_cnt_cod: cnt_cod,
        eduzz_event: "create",
        eduzz_valor: valor,
        eduzz_cli_email: cli_email,
      },
    });

    await logRow({ clinic_id: clinicId, processed_status: "ok" });
    return ok({ note: "plan_activated", clinic_id: clinicId });
  } catch (e: any) {
    console.error("eduzz-webhook error", e);
    try {
      await logRow({ processed_status: "error", error_msg: e?.message ?? String(e) });
    } catch {}
    return ok({ note: "error_logged" });
  }
});

// === helpers ===

async function applyPlanToClinic(
  admin: any,
  clinicId: string,
  plan: { id: string; code: string; features: any; limits: any },
  opts: { source: string; status: string; grant_reason: string; metadata: Record<string, any> },
) {
  // Update clinic plan + settings
  const { data: clinic } = await admin
    .from("clinics")
    .select("settings")
    .eq("id", clinicId)
    .maybeSingle();
  const settings = { ...((clinic?.settings as any) ?? {}) };
  settings.features = plan.features ?? {};
  settings.limits = plan.limits ?? {};

  await admin.from("clinics")
    .update({ plan_id: plan.id, plan: plan.code, settings })
    .eq("id", clinicId);

  // Cancel current sub
  await admin
    .from("clinic_subscriptions")
    .update({ is_current: false, canceled_at: new Date().toISOString() })
    .eq("clinic_id", clinicId)
    .eq("is_current", true);

  // Insert new sub
  await admin.from("clinic_subscriptions").insert({
    clinic_id: clinicId,
    plan_id: plan.id,
    status: opts.status,
    source: opts.source,
    grant_reason: opts.grant_reason,
    is_current: true,
    metadata: opts.metadata,
  });

  // Audit
  await admin.from("audit_log").insert({
    clinic_id: clinicId,
    action: "plan.apply",
    entity: "clinic_subscriptions",
    diff: { plan_code: plan.code, source: opts.source, status: opts.status, reason: opts.grant_reason },
  }).then(() => {}).catch(() => {});
}

async function createClinicForNewUser(
  admin: any,
  args: { email: string; name: string | null },
): Promise<{ ok: true; user_id: string; clinic_id: string } | { ok: false; error: string }> {
  // 1) Create auth user (sends magic link / invite-style email)
  const fullName = args.name ?? args.email.split("@")[0];
  const redirectTo = `${Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".lovable.app")}/auth`;

  // Use generateLink so user gets an email to set password
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(args.email, {
    data: { full_name: fullName, source: "eduzz" },
  });

  let userId = invited?.user?.id;
  if (inviteErr || !userId) {
    // User may already exist in auth — fetch
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === args.email);
    if (!existing) return { ok: false, error: inviteErr?.message ?? "invite_failed" };
    userId = existing.id;
  }

  // 2) Ensure profile
  await admin.from("profiles").upsert(
    { user_id: userId, email: args.email, full_name: fullName },
    { onConflict: "user_id" },
  );

  // 3) Create clinic
  const baseSlug = (fullName || args.email.split("@")[0])
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    .slice(0, 40) || "cliente";
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  const { data: clinic, error: clinicErr } = await admin
    .from("clinics")
    .insert({ name: fullName, slug, status: "active", plan: "starter" })
    .select("id")
    .single();
  if (clinicErr || !clinic) return { ok: false, error: clinicErr?.message ?? "clinic_create_failed" };

  // 4) Membership as owner (clinic_members has user_id UNIQUE)
  const { error: memErr } = await admin
    .from("clinic_members")
    .upsert({ clinic_id: clinic.id, user_id: userId, role: "owner" }, { onConflict: "user_id" });
  if (memErr) return { ok: false, error: memErr.message };

  return { ok: true, user_id: userId!, clinic_id: clinic.id };
}

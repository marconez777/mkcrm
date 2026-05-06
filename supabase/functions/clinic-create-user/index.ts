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

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { email, password, full_name, role } = body ?? {};
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email e senha são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof password !== "string" || password.length < 8) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 8 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const memberRole = ["owner", "admin", "professional", "viewer"].includes(role) ? role : "professional";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify caller is owner/admin of a clinic OR super_admin
    const [{ data: superRow }, { data: callerMember }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", callerId).eq("role", "super_admin").maybeSingle(),
      admin.from("clinic_members").select("clinic_id, role").eq("user_id", callerId).maybeSingle(),
    ]);
    const isSuper = !!superRow;
    const isClinicAdmin = callerMember && (callerMember.role === "owner" || callerMember.role === "admin");

    if (!isSuper && !isClinicAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let clinicId = body.clinic_id as string | undefined;
    if (!clinicId) {
      if (!callerMember?.clinic_id) {
        return new Response(JSON.stringify({ error: "clinic_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      clinicId = callerMember.clinic_id;
    } else if (!isSuper && callerMember?.clinic_id !== clinicId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create user (auto-confirmed so they can log in immediately)
    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: full_name ? { full_name } : undefined,
    });

    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Falha ao criar usuário" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newUserId = created.user.id;

    // Ensure profile + membership (handle_new_user trigger may have created profile already)
    await admin.from("profiles").upsert({ user_id: newUserId, email: normalizedEmail, full_name: full_name ?? null }, { onConflict: "user_id" });

    const { error: memberErr } = await admin
      .from("clinic_members")
      .upsert({ clinic_id: clinicId, user_id: newUserId, role: memberRole }, { onConflict: "user_id" });

    if (memberErr) {
      return new Response(JSON.stringify({ error: memberErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, user_id: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("clinic-create-user error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

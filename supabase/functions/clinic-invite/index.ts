import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { clinic_id, email, role } = body ?? {};
    if (!clinic_id || !email) {
      return new Response(JSON.stringify({ error: "clinic_id and email are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const inviteRole = ["owner", "admin", "professional", "viewer"].includes(role) ? role : "owner";

    // Authorization: super_admin OR clinic admin/owner of the clinic
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: superRow }, { data: memberRow }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle(),
      admin.from("clinic_members").select("role, clinic_id").eq("user_id", userId).maybeSingle(),
    ]);
    const isSuper = !!superRow;
    const isClinicAdmin = memberRow?.clinic_id === clinic_id && (memberRow?.role === "owner" || memberRow?.role === "admin");
    if (!isSuper && !isClinicAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create invite
    const { data: invite, error: inviteErr } = await admin
      .from("clinic_invites")
      .insert({ clinic_id, email: email.toLowerCase(), role: inviteRole, invited_by: userId })
      .select("token, expires_at")
      .single();
    if (inviteErr) throw inviteErr;

    const { data: clinic } = await admin.from("clinics").select("name").eq("id", clinic_id).single();

    const inviteUrl = `https://crm.mkart.com.br/invite/${invite!.token}`;

    return new Response(JSON.stringify({ ok: true, invite_url: inviteUrl, expires_at: invite!.expires_at, clinic_name: clinic?.name ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("clinic-invite error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

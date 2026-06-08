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
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const perPage = Math.min(200, Number(url.searchParams.get("per_page") ?? "50"));
    const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();

    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const users = list?.users ?? [];
    const ids = users.map((u) => u.id);

    const [{ data: profiles }, { data: members }, { data: roles }, { data: lockouts }, sessionsRes] = await Promise.all([
      admin.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids),
      admin.from("clinic_members").select("user_id, clinic_id, role, clinic:clinics(id,name,slug)").in("user_id", ids),
      admin.from("user_roles").select("user_id, role").in("user_id", ids),
      admin.from("auth_lockouts").select("email, locked_until, failed_attempts").in("email", users.map((u) => (u.email ?? "").toLowerCase()).filter(Boolean)),
      admin.schema("auth").from("sessions").select("user_id, updated_at").in("user_id", ids).order("updated_at", { ascending: false }),
    ]);

    // Compute MAX(updated_at) per user from auth.sessions (reflects real activity via token refresh)
    const lastSeenMap = new Map<string, string>();
    for (const s of (sessionsRes?.data ?? []) as any[]) {
      const existing = lastSeenMap.get(s.user_id);
      if (!existing || new Date(s.updated_at) > new Date(existing)) {
        lastSeenMap.set(s.user_id, s.updated_at);
      }
    }

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    const memberMap = new Map((members ?? []).map((m: any) => [m.user_id, m]));
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }
    const lockoutMap = new Map((lockouts ?? []).map((l: any) => [l.email?.toLowerCase(), l]));

    let rows = users.map((u) => {
      const prof: any = profileMap.get(u.id) ?? {};
      const mem: any = memberMap.get(u.id);
      const userRoles = roleMap.get(u.id) ?? [];
      const lockout: any = lockoutMap.get((u.email ?? "").toLowerCase());
      const locked = !!(lockout?.locked_until && new Date(lockout.locked_until) > new Date());
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        full_name: prof.full_name ?? u.user_metadata?.full_name ?? null,
        avatar_url: prof.avatar_url ?? null,
        clinic_id: mem?.clinic_id ?? null,
        clinic_name: mem?.clinic?.name ?? null,
        clinic_role: mem?.role ?? null,
        is_super_admin: userRoles.includes("super_admin"),
        locked,
        locked_until: lockout?.locked_until ?? null,
        failed_attempts: lockout?.failed_attempts ?? 0,
      };
    });

    if (search) {
      rows = rows.filter((r) =>
        (r.email ?? "").toLowerCase().includes(search) ||
        (r.full_name ?? "").toLowerCase().includes(search) ||
        (r.clinic_name ?? "").toLowerCase().includes(search),
      );
    }

    return new Response(JSON.stringify({
      users: rows,
      page,
      per_page: perPage,
      total: list?.total ?? rows.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("admin-users-list error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

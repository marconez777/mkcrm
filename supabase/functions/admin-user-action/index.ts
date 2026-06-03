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
    const action = body.action as string;
    const userId = body.user_id as string;
    if (!action || !userId) {
      return new Response(JSON.stringify({ error: "action e user_id obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: target } = await admin.auth.admin.getUserById(userId);
    if (!target?.user) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    switch (action) {
      case "set_password": {
        const password = body.password as string;
        if (!password || password.length < 8) {
          return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 8 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        if (error) throw error;
        break;
      }
      case "unlock": {
        if (target.user.email) {
          await admin.from("auth_lockouts").delete().eq("email", target.user.email.toLowerCase());
        }
        break;
      }
      case "sign_out": {
        const { error } = await admin.auth.admin.signOut(userId);
        if (error) throw error;
        break;
      }
      case "set_super_admin": {
        if (body.enable) {
          await admin.from("user_roles").upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role" });
        } else {
          await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "super_admin");
        }
        break;
      }
      case "set_clinic_role": {
        const clinicId = body.clinic_id as string;
        const role = body.role as string;
        if (!clinicId || !["owner", "admin", "professional", "viewer"].includes(role)) {
          return new Response(JSON.stringify({ error: "clinic_id ou role inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await admin.from("clinic_members").upsert({ user_id: userId, clinic_id: clinicId, role }, { onConflict: "user_id" });
        break;
      }
      case "delete_user": {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw error;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Ação desconhecida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("admin-user-action error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

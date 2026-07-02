// supabase/functions/admin-delete-clinic/index.ts
//
// Exclui completamente uma clínica:
// 1. Lista todos os membros (clinic_members).
// 2. Para cada usuário: se for membro APENAS desta clínica, apaga o auth.user
//    (e por cascade, profiles/roles/etc). Caso contrário apenas remove a
//    membership.
// 3. Apaga a clínica (FKs ON DELETE CASCADE cuidam dos dados relacionados).
//
// Requer: chamador autenticado com role super_admin.

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
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: superRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!superRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const clinicId = body.clinic_id as string | undefined;
    const confirmSlug = (body.confirm_slug as string | undefined)?.trim();
    if (!clinicId) return json({ error: "clinic_id obrigatório" }, 400);

    const { data: clinic, error: clinicErr } = await admin
      .from("clinics")
      .select("id, name, slug")
      .eq("id", clinicId)
      .maybeSingle();
    if (clinicErr) throw clinicErr;
    if (!clinic) return json({ error: "Clínica não encontrada" }, 404);
    if (!confirmSlug || confirmSlug !== clinic.slug) {
      return json({ error: `Confirmação inválida — digite o slug exato: ${clinic.slug}` }, 400);
    }

    // 1) Coleta membros desta clínica
    const { data: members } = await admin
      .from("clinic_members")
      .select("user_id")
      .eq("clinic_id", clinicId);

    const userIds = Array.from(new Set((members ?? []).map((m: any) => m.user_id as string)));

    // 2) Para cada user, decide se apaga auth user ou só remove membership
    const deletedUsers: string[] = [];
    const detachedUsers: string[] = [];
    const failedUsers: { user_id: string; error: string }[] = [];

    for (const uid of userIds) {
      const { data: otherMemberships } = await admin
        .from("clinic_members")
        .select("clinic_id")
        .eq("user_id", uid)
        .neq("clinic_id", clinicId)
        .limit(1);

      if ((otherMemberships ?? []).length === 0) {
        // Único vínculo: apaga o auth user (cascade limpa profile/roles).
        const { error: delErr } = await admin.auth.admin.deleteUser(uid);
        if (delErr) {
          // Tenta limpar manualmente o que conseguir e segue
          await admin.from("user_roles").delete().eq("user_id", uid);
          await admin.from("profiles").delete().eq("id", uid);
          failedUsers.push({ user_id: uid, error: delErr.message });
        } else {
          deletedUsers.push(uid);
        }
      } else {
        // Mantém o user; só remove o vínculo com esta clínica.
        await admin.from("clinic_members").delete().eq("user_id", uid).eq("clinic_id", clinicId);
        detachedUsers.push(uid);
      }
    }

    // 3) Apaga a clínica (cascade trata as demais tabelas)
    const { error: clinicDelErr } = await admin.from("clinics").delete().eq("id", clinicId);
    if (clinicDelErr) throw clinicDelErr;

    return json({
      ok: true,
      clinic: { id: clinic.id, name: clinic.name, slug: clinic.slug },
      users_deleted: deletedUsers.length,
      users_detached: detachedUsers.length,
      users_failed: failedUsers,
    });
  } catch (e: any) {
    console.error("admin-delete-clinic error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

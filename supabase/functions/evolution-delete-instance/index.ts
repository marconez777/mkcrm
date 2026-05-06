import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await userClient.auth.getClaims(auth.slice(7));
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const [{ data: member }, { data: roles }] = await Promise.all([
      admin.from("clinic_members").select("clinic_id, role").eq("user_id", userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const isSuper = roles?.some((r: any) => r.role === "super_admin");
    if (!isSuper && !member) return json({ error: "Forbidden" }, 403);

    const { instance_id } = await req.json().catch(() => ({}));
    if (!instance_id) return json({ error: "instance_id required" }, 400);

    const { data: inst } = await admin
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instance_id)
      .maybeSingle();
    if (!inst) return json({ error: "Not found" }, 404);
    if (!isSuper && member?.clinic_id !== inst.clinic_id) return json({ error: "Forbidden" }, 403);

    // Try delete remote (best effort)
    try {
      await fetch(`${inst.evolution_url.replace(/\/$/, "")}/instance/delete/${encodeURIComponent(inst.evolution_instance)}`, {
        method: "DELETE",
        headers: { apikey: inst.evolution_api_key },
      });
    } catch (e) { console.warn("evo delete failed", e); }

    const { error } = await admin.from("whatsapp_instances").delete().eq("id", instance_id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

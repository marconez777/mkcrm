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

function slugify(s: string): string {
  return (s || "clinic")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24) || "clinic";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const EVO_URL = Deno.env.get("EVOLUTION_GLOBAL_URL")?.replace(/\/$/, "");
    const EVO_KEY = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!EVO_URL || !EVO_KEY) return json({ error: "Evolution global config missing" }, 500);

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await userClient.auth.getClaims(auth.slice(7));
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Permission check
    const [{ data: member }, { data: roles }] = await Promise.all([
      admin.from("clinic_members").select("clinic_id, role, clinic:clinics(slug)").eq("user_id", userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const isSuper = roles?.some((r: any) => r.role === "super_admin");
    if (!member && !isSuper) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim() || "WhatsApp";
    const clinicId = member?.clinic_id ?? body?.clinic_id;
    if (!clinicId) return json({ error: "clinic_id required" }, 400);

    const clinicSlug = (member?.clinic as any)?.slug ?? "clinic";
    const shortId = crypto.randomUUID().slice(0, 8);
    const instanceName = `${slugify(clinicSlug)}-${shortId}`;
    const webhookToken = crypto.randomUUID().replace(/-/g, "");
    const instanceApiKey = crypto.randomUUID().replace(/-/g, "");
    const webhookUrl = `${SUPABASE_URL}/functions/v1/evolution-webhook?token=${webhookToken}`;

    // Create instance on Evolution
    const evoRes = await fetch(`${EVO_URL}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVO_KEY },
      body: JSON.stringify({
        instanceName,
        token: instanceApiKey,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_SET",
            "MESSAGING_HISTORY_SET",
            "CHATS_UPSERT",
            "CHATS_SET",
            "CONTACTS_UPSERT",
            "CONNECTION_UPDATE",
          ],
        },
      }),
    });
    if (!evoRes.ok) {
      const t = await evoRes.text().catch(() => "");
      return json({ error: `Evolution create failed: ${evoRes.status} ${t.slice(0, 300)}` }, 502);
    }

    // Check if clinic has any default already
    const { data: existing } = await admin
      .from("whatsapp_instances")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("is_default", true)
      .maybeSingle();

    const { data: inserted, error: insErr } = await admin
      .from("whatsapp_instances")
      .insert({
        clinic_id: clinicId,
        name,
        evolution_url: EVO_URL,
        evolution_api_key: instanceApiKey,
        evolution_instance: instanceName,
        webhook_token: webhookToken,
        is_default: !existing,
      })
      .select("id")
      .single();
    if (insErr) {
      // best-effort cleanup
      await fetch(`${EVO_URL}/instance/delete/${encodeURIComponent(instanceName)}`, {
        method: "DELETE",
        headers: { apikey: EVO_KEY },
      }).catch(() => {});
      return json({ error: `DB insert failed: ${insErr.message}` }, 500);
    }

    return json({ instance_id: inserted.id, instanceName });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

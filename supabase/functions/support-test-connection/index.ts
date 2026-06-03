// Tests an OpenAI API key + model with a 1-token completion. Super admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: superRow } = await admin.from("user_roles")
      .select("role").eq("user_id", userData.user.id).eq("role", "super_admin").maybeSingle();
    if (!superRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const useStored = !body?.api_key;
    let apiKey: string | null = body?.api_key ?? null;
    let model: string = body?.model ?? "gpt-4o-mini";

    if (useStored) {
      const { data: cfg } = await admin.from("support_agent_config")
        .select("api_key, model").eq("singleton", true).maybeSingle();
      apiKey = cfg?.api_key ?? null;
      if (!body?.model) model = cfg?.model ?? "gpt-4o-mini";
    }
    if (!apiKey) return json({ error: "API key não configurada" }, 400);

    const t0 = Date.now();
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    });
    const latency = Date.now() - t0;
    if (!r.ok) {
      const text = await r.text();
      return json({ ok: false, status: r.status, error: text.slice(0, 500), latency_ms: latency }, 200);
    }
    return json({ ok: true, latency_ms: latency, model });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

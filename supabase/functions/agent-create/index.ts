// Cria um ai_agent novo a partir do AgentWizard.
// Centraliza a leitura da "builder shared key" no servidor — a chave nunca trafega para o client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BodySchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  niche: z.string().nullable().optional(),
  niche_other: z.string().nullable().optional(),
  key_source: z.enum(["builder", "own"]),
  // Only used when key_source = "own":
  own_provider: z.string().optional(),
  own_api_key: z.string().optional(),
  own_base_url: z.string().nullable().optional(),
  own_model: z.string().optional(),
  // Common config:
  system_prompt: z.string().min(1),
  temperature: z.number(),
  max_iterations: z.number(),
  rag_top_k: z.number(),
  tools: z.array(z.unknown()).default([]),
  verified_at: z.string().nullable().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const auth = req.headers.get("Authorization");
  if (!auth) return json(401, { error: "unauthorized" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json(401, { error: "unauthorized" });

  const { data: membership } = await userClient
    .from("clinic_members").select("clinic_id, role").eq("user_id", user.id).maybeSingle();
  if (!membership) return json(403, { error: "no clinic" });
  if (!["owner", "admin"].includes(membership.role)) return json(403, { error: "forbidden" });
  const clinicId = membership.clinic_id;

  let body: unknown;
  try { body = await req.json(); } catch { return json(400, { error: "invalid json" }); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
  const p = parsed.data;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let provider = "";
  let apiKey = "";
  let baseUrl: string | null = null;
  let model = "";

  if (p.key_source === "builder") {
    const { data: builder, error: bErr } = await admin
      .from("ai_agents")
      .select("provider, api_key, base_url, model")
      .eq("clinic_id", clinicId)
      .eq("system_key", "builder")
      .maybeSingle();
    if (bErr) return json(500, { error: bErr.message });
    if (!builder || !builder.api_key) return json(400, { error: "builder_key_missing" });
    provider = builder.provider ?? "openai";
    apiKey = builder.api_key;
    baseUrl = builder.base_url ?? null;
    model = builder.model ?? "";
  } else {
    if (!p.own_provider || !p.own_api_key || !p.own_model) {
      return json(400, { error: "own_provider/own_api_key/own_model required" });
    }
    provider = p.own_provider;
    apiKey = p.own_api_key;
    baseUrl = p.own_base_url ?? null;
    model = p.own_model;
  }

  const { data: inserted, error: insErr } = await admin
    .from("ai_agents")
    .insert({
      clinic_id: clinicId,
      name: p.name,
      description: p.description ?? null,
      role: p.role ?? null,
      niche: p.niche ?? null,
      niche_other: p.niche_other ?? null,
      provider,
      api_key: apiKey,
      base_url: baseUrl,
      model,
      system_prompt: p.system_prompt,
      temperature: p.temperature,
      max_iterations: p.max_iterations,
      rag_top_k: p.rag_top_k,
      tools: p.tools,
      enabled: false,
      draft_mode: true,
      builder_verified_at: p.key_source === "builder" ? new Date().toISOString() : (p.verified_at ?? null),
    })
    .select("id")
    .single();
  if (insErr) return json(500, { error: insErr.message });

  return json(200, { id: (inserted as { id: string }).id });
});

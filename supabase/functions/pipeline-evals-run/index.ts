// supabase/functions/pipeline-evals-run/index.ts
//
// Marco 4 — runner mínimo de avaliação offline para agent_evals.
// Roda os prompts cadastrados contra o mesmo modelo do classifier
// e marca last_passed se a resposta contiver TODOS os expected_contains.
// NÃO altera produção; só preenche last_response/last_passed/last_run_at.
//
// Invocar com: { action: "run", limit?: number, agent_id?: string }
// Autenticação: service_role apenas (verificado via JWT).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { generateText } from "npm:ai@^6";
import { getClinicOpenAI } from "../_shared/clinic-openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "gpt-5-mini";

function isServiceRole(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  try {
    const token = authHeader.slice(7);
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!isServiceRole(req.headers.get("Authorization"))) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit ?? 20), 100);
  const agentId: string | undefined = body.agent_id;

  const client = createClient(SUPABASE_URL, SERVICE_KEY);
  let q = client.from("agent_evals").select("id, agent_id, clinic_id, prompt, expected_contains").limit(limit);
  if (agentId) q = q.eq("agent_id", agentId);
  const { data: evals, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiCache = new Map<string, Awaited<ReturnType<typeof getClinicOpenAI>>>();
  async function aiFor(clinicId: string) {
    if (!aiCache.has(clinicId)) aiCache.set(clinicId, await getClinicOpenAI(client, clinicId));
    return aiCache.get(clinicId) ?? null;
  }

  const results: Array<{ id: string; passed: boolean; missing: string[]; error?: string }> = [];
  for (const ev of evals ?? []) {
    try {
      const ai = await aiFor(ev.clinic_id as string);
      if (!ai) {
        results.push({ id: ev.id, passed: false, missing: [], error: "no_clinic_openai_key" });
        continue;
      }
      const { text } = await generateText({ model: ai.model(MODEL), prompt: ev.prompt });
      const lower = text.toLowerCase();
      const expected: string[] = ev.expected_contains ?? [];
      const missing = expected.filter((e) => !lower.includes(String(e).toLowerCase()));
      const passed = missing.length === 0;
      await client
        .from("agent_evals")
        .update({
          last_response: text.slice(0, 4000),
          last_passed: passed,
          last_run_at: new Date().toISOString(),
        })
        .eq("id", ev.id);
      results.push({ id: ev.id, passed, missing });
    } catch (err) {
      results.push({ id: ev.id, passed: false, missing: ["__error__"], error: err instanceof Error ? err.message : String(err) });
      console.error("[evals-run] failed", ev.id, err);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  return new Response(
    JSON.stringify({ total: results.length, passed, accuracy: results.length ? passed / results.length : 0, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

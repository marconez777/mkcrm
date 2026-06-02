// AI helper for inbox: suggest replies and summarize lead conversation.
// Uses the clinic's own AI agent (provider + api_key configured per agent in IA → Agentes).
// No Lovable AI Gateway / default provider — if no agent is configured, returns 400.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/evolution.ts";
import { assertSpendAllowed, SpendLimitExceeded } from "../_shared/spend-guard.ts";
import { chatCompletion, type Agent } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const AGENT_COLS = "id, provider, api_key, base_url, model, temperature, system_prompt, embedding_model, embedding_api_key, role";

/**
 * Find a usable agent for the given clinic.
 * Order of preference: role match → role="summary" → any enabled agent.
 * Requires an api_key — agents without one are skipped.
 */
async function pickAgent(sb: ReturnType<typeof createClient>, clinic_id: string, preferredRole: string): Promise<any | null> {
  const { data } = await sb
    .from("ai_agents")
    .select(AGENT_COLS)
    .eq("clinic_id", clinic_id)
    .eq("enabled", true);
  const list = (data ?? []) as any[];
  const withKey = list.filter((a) => typeof a.api_key === "string" && a.api_key.length > 0);
  return (
    withKey.find((a) => a.role === preferredRole) ??
    withKey.find((a) => a.role === "summary") ??
    withKey[0] ??
    null
  );
}

function asAgent(row: any, fallbackTemp: number, fallbackPrompt: string): Agent & { system_prompt: string } {
  return {
    id: row.id,
    provider: row.provider,
    api_key: row.api_key,
    base_url: row.base_url ?? null,
    model: row.model,
    temperature: typeof row.temperature === "number" ? row.temperature : fallbackTemp,
    embedding_model: row.embedding_model ?? null,
    embedding_api_key: row.embedding_api_key ?? null,
    system_prompt: row.system_prompt || fallbackPrompt,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  try {
    const { lead_id, mode } = await req.json();
    if (!lead_id || !["suggest", "summary"].includes(mode)) {
      return json({ error: "lead_id and mode (suggest|summary) required" }, 400);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: lead } = await sb
      .from("leads")
      .select("name, phone, email, company, deal_value, notes, tags, clinic_id")
      .eq("id", lead_id)
      .single();
    if (!lead) return json({ error: "lead not found" }, 404);
    try { await assertSpendAllowed((lead as any).clinic_id ?? null); } catch (e) {
      if (e instanceof SpendLimitExceeded) return json(e.body, 402);
      throw e;
    }
    const { data: msgs } = await sb
      .from("messages")
      .select("from_me, content, message_type, timestamp")
      .eq("lead_id", lead_id)
      .order("timestamp", { ascending: false })
      .limit(30);

    const conv = (msgs ?? [])
      .reverse()
      .map((m) => `${m.from_me ? "Atendente" : (lead?.name || "Cliente")}: ${m.content || `[${m.message_type}]`}`)
      .join("\n");

    const preferredRole = mode === "summary" ? "summary" : "assist";
    const row = await pickAgent(sb, (lead as any).clinic_id, preferredRole);
    if (!row) {
      return json({
        error: "Nenhum agente de IA com API key configurada. Vá em IA → Agentes e configure o provedor e a API key para usar este recurso.",
      }, 400);
    }

    if (mode === "summary") {
      const fallbackPrompt =
        "Você resume conversas de WhatsApp de vendas em português. Em 2-3 frases curtas, descreva o status do lead, principal interesse e próximo passo recomendado. Sem títulos, sem markdown.";
      const agent = asAgent(row, 0.2, fallbackPrompt);
      const resp = await chatCompletion(agent, [
        { role: "system", content: agent.system_prompt },
        { role: "user", content: `Lead: ${JSON.stringify(lead)}\n\nConversa:\n${conv}` },
      ], undefined, { agent_id: agent.id, lead_id, note: "summary" });
      if (!resp.ok) return json({ error: `Provedor ${agent.provider} (${resp.status}): ${resp.errorText?.slice(0, 300) ?? "erro desconhecido"}` }, 502);
      const content = resp.choices?.[0]?.message?.content ?? "";
      await sb.from("leads").update({ ai_summary: content, ai_summary_at: new Date().toISOString() }).eq("id", lead_id);
      return json({ ok: true, summary: content });
    }

    // suggest
    const fallbackPrompt =
      'Você é um assistente que sugere 3 respostas curtas, naturais, em português, para o atendente enviar agora. Responda APENAS um JSON: {"suggestions":["...","...","..."]} sem texto extra.';
    const agent = asAgent(row, 0.5, fallbackPrompt);
    const resp = await chatCompletion(agent, [
      { role: "system", content: agent.system_prompt },
      { role: "user", content: `Lead: ${JSON.stringify(lead)}\n\nConversa:\n${conv}` },
    ], undefined, { agent_id: agent.id, lead_id, note: "suggest" });
    if (!resp.ok) return json({ error: `Provedor ${agent.provider} (${resp.status}): ${resp.errorText?.slice(0, 300) ?? "erro desconhecido"}` }, 502);
    const raw = resp.choices?.[0]?.message?.content ?? "";
    let suggestions: string[] = [];
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      suggestions = JSON.parse(cleaned).suggestions ?? [];
    } catch {
      suggestions = raw.split("\n").map((l: string) => l.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean).slice(0, 3);
    }
    return json({ ok: true, suggestions });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

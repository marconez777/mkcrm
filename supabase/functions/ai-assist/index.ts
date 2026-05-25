// AI helper for inbox: suggest replies and summarize lead conversation.
// Uses Lovable AI Gateway (LOVABLE_API_KEY) — no per-agent setup needed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/evolution.ts";
import { assertSpendAllowed, SpendLimitExceeded } from "../_shared/spend-guard.ts";

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

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Map legacy / unsupported model identifiers to ones allowed by the Lovable AI Gateway.
function normalizeModel(model?: string | null): string {
  const fallback = "google/gemini-2.5-flash";
  if (!model) return fallback;
  const m = String(model).trim().toLowerCase();
  // Already namespaced (e.g. "openai/gpt-5", "google/gemini-2.5-pro")
  if (m.includes("/")) {
    // Reject legacy openai models that the gateway no longer accepts
    if (/openai\/(gpt-4o|gpt-4|gpt-3|gpt-4-turbo|gpt-4o-mini)/.test(m)) return fallback;
    return m;
  }
  // Bare names: best-effort map
  if (m.startsWith("gemini")) return `google/${m}`;
  if (m.startsWith("gpt-5")) return `openai/${m}`;
  // Legacy / unknown (gpt-4o, gpt-4, gpt-3.5, claude-*, etc.)
  return fallback;
}

async function callAI(messages: any[], model = "google/gemini-2.5-flash", temperature = 0.5) {
  const finalModel = normalizeModel(model);
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: finalModel, messages, temperature }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI ${r.status}: ${t.slice(0, 300)}`);
  }
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
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
    try { await assertSpendAllowed((lead as any)?.clinic_id ?? null); } catch (e) {
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

    if (mode === "summary") {
      // Look up the dedicated "summary" agent for this clinic (top performance)
      const { data: agent } = await sb
        .from("ai_agents")
        .select("system_prompt, model, temperature")
        .eq("role", "summary")
        .eq("enabled", true)
        .eq("clinic_id", (lead as any)?.clinic_id)
        .maybeSingle();

      const systemPrompt = agent?.system_prompt
        ?? "Você resume conversas de WhatsApp de vendas em português. Em 2-3 frases curtas, descreva o status do lead, principal interesse e próximo passo recomendado. Sem títulos, sem markdown.";
      const model = agent?.model ?? "openai/gpt-5";
      const temperature = typeof agent?.temperature === "number" ? Number(agent.temperature) : 0.2;

      const content = await callAI(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Lead: ${JSON.stringify(lead)}\n\nConversa:\n${conv}` },
        ],
        model,
        temperature,
      );
      await sb.from("leads").update({ ai_summary: content, ai_summary_at: new Date().toISOString() }).eq("id", lead_id);
      return json({ ok: true, summary: content });
    }

    // suggest: 3 short replies as JSON array
    const raw = await callAI([
      {
        role: "system",
        content:
          'Você é um assistente que sugere 3 respostas curtas, naturais, em português, para o atendente enviar agora. Responda APENAS um JSON: {"suggestions":["...","...","..."]} sem texto extra.',
      },
      { role: "user", content: `Lead: ${JSON.stringify(lead)}\n\nConversa:\n${conv}` },
    ]);
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

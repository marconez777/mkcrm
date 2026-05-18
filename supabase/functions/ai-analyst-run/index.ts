// Analista de Conversas — agente em LOTE que analisa conversas recentes
// e alimenta agent_memory (via remember_fact) + ai_insights (via generate_insight_report)
// + add_lead_note. Não envia mensagem para o lead. Disparado por cron diário.
//
// Body opcional:
//   { clinic_id?: string, lead_id?: string, since_hours?: number=24,
//     limit?: number=25, agent_id?: string }
import { corsHeaders, json, sb } from "../_shared/evolution.ts";
import { pmap } from "../_shared/utils.ts";

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` };

const ANALYSIS_PROMPT = `Você é o ANALISTA DE CONVERSAS. Analise o histórico abaixo do lead e produza inteligência comercial silenciosa.

REGRAS:
1. NUNCA escreva resposta para o cliente. Saída final = string vazia.
2. Etapas obrigatórias nesta ordem:
   a) Chame remember_fact UMA VEZ para cada fato durável identificado (objeção, dúvida nova, interesse, motivação, padrão de comportamento, sumiço, menção a concorrente, sensibilidade a preço, gatilho de decisão). Não duplique fatos já registrados (veja "Memórias existentes" se houver).
   b) Se houver insight relevante para a equipe (ex.: lead esfriou, padrão preocupante, oportunidade), chame add_lead_note com 1 frase objetiva.
   c) Por último, chame generate_insight_report UMA VEZ consolidando: summary, sentiment, top_objections, top_doubts, top_interests, drop_off_reasons, recommendations.
3. recommendations deve sugerir melhorias concretas (script, copy, abordagem, oferta) — pense como diretor comercial.
4. Seja factual. Não invente. Se a conversa for muito curta para uma seção, devolva array vazio.`;

async function findAnalystAgent(supabase: any, clinicId: string, override?: string) {
  if (override) {
    const { data } = await supabase.from("ai_agents")
      .select("id, clinic_id, enabled").eq("id", override).maybeSingle();
    if (data?.enabled && data.clinic_id === clinicId) return data.id as string;
    return null;
  }
  const { data } = await supabase.from("ai_agents")
    .select("id").eq("clinic_id", clinicId).eq("role", "analyst").eq("enabled", true)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return data?.id ?? null;
}

async function analyzeLead(supabase: any, agentId: string, leadId: string) {
  // Pega últimas 50 mensagens
  const { data: msgs } = await supabase.from("messages")
    .select("from_me, content, timestamp, bot_agent_id")
    .eq("lead_id", leadId).order("timestamp", { ascending: false }).limit(50);
  const ordered = (msgs ?? []).reverse().filter((m: any) => m.content);
  if (ordered.length < 3) return { skipped: true, reason: "too-few-messages" };

  // Memórias já existentes para evitar duplicação
  const { data: existingMem } = await supabase.from("agent_memory")
    .select("kind, content").eq("agent_id", agentId).eq("lead_id", leadId)
    .order("created_at", { ascending: false }).limit(40);
  const memBlock = (existingMem ?? []).length
    ? `\n\n## Memórias existentes (NÃO duplique)\n` +
      existingMem!.map((m: any) => `- [${m.kind}] ${m.content}`).join("\n")
    : "";

  const transcript = ordered.map((m: any) => {
    const when = new Date(m.timestamp).toISOString().slice(0, 16).replace("T", " ");
    const who = m.from_me ? (m.bot_agent_id ? "bot" : "atendente") : "lead";
    return `[${who} ${when}] ${m.content}`;
  }).join("\n");

  // Thread dedicada do analista
  let { data: thread } = await supabase.from("ai_threads")
    .select("id").eq("lead_id", leadId).eq("agent_id", agentId).maybeSingle();
  if (!thread) {
    const { data: t } = await supabase.from("ai_threads")
      .insert({ lead_id: leadId, agent_id: agentId, title: "Analista de Conversas" })
      .select("id").single();
    thread = t;
  }

  const userMsg = `${ANALYSIS_PROMPT}${memBlock}\n\n## Transcrição (${ordered.length} mensagens)\n${transcript}`;

  const aiResp = await fetch(`${FUNCTIONS_URL}/ai-chat`, {
    method: "POST", headers: authHeaders,
    body: JSON.stringify({
      agent_id: agentId,
      lead_id: leadId,
      thread_id: thread?.id,
      persist: false,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  const data = await aiResp.json().catch(() => ({}));
  if (!aiResp.ok) return { ok: false, error: (data as any)?.error ?? `HTTP ${aiResp.status}` };
  return {
    ok: true,
    tools_used: ((data as any).tools_used ?? []).length,
    lead_id: leadId,
  };
}

async function processClinic(supabase: any, clinicId: string, opts: {
  sinceHours: number; limit: number; leadId?: string; agentOverride?: string;
}) {
  const agentId = await findAnalystAgent(supabase, clinicId, opts.agentOverride);
  if (!agentId) return { clinic_id: clinicId, skipped: true, reason: "no-analyst-agent" };

  let leadIds: string[];
  if (opts.leadId) {
    leadIds = [opts.leadId];
  } else {
    const since = new Date(Date.now() - opts.sinceHours * 3600 * 1000).toISOString();
    const { data: leads } = await supabase.from("leads")
      .select("id, last_message_at")
      .eq("clinic_id", clinicId)
      .gte("last_message_at", since)
      .order("last_message_at", { ascending: false })
      .limit(opts.limit);
    leadIds = (leads ?? []).map((l: any) => l.id);
  }

  if (leadIds.length === 0) return { clinic_id: clinicId, agent_id: agentId, processed: 0 };

  const results = await pmap(leadIds, 3, (lid) => analyzeLead(supabase, agentId, lid));
  const ok = results.filter((r: any) => r.ok).length;
  const skipped = results.filter((r: any) => r.skipped).length;
  const failed = results.length - ok - skipped;
  return { clinic_id: clinicId, agent_id: agentId, processed: results.length, ok, skipped, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const sinceHours = Math.max(1, Math.min(Number(body.since_hours) || 24, 168));
    const limit = Math.max(1, Math.min(Number(body.limit) || 25, 100));
    const leadId = body.lead_id ?? undefined;
    const agentOverride = body.agent_id ?? undefined;

    let clinicIds: string[];
    if (body.clinic_id) {
      clinicIds = [body.clinic_id];
    } else if (leadId) {
      const { data: l } = await supabase.from("leads").select("clinic_id").eq("id", leadId).single();
      if (!l?.clinic_id) return json({ error: "lead not found" }, 404);
      clinicIds = [l.clinic_id];
    } else {
      // Todas as clínicas que têm um analista ativo
      const { data: agents } = await supabase.from("ai_agents")
        .select("clinic_id").eq("role", "analyst").eq("enabled", true);
      clinicIds = Array.from(new Set((agents ?? []).map((a: any) => a.clinic_id).filter(Boolean)));
    }

    if (clinicIds.length === 0) return json({ ok: true, processed: 0, reason: "no-clinics" });

    const results = await pmap(clinicIds, 2, (cid) =>
      processClinic(supabase, cid, { sinceHours, limit, leadId, agentOverride })
    );
    console.log("[analyst-run] done", JSON.stringify(results));
    return json({ ok: true, results });
  } catch (e) {
    console.error("[analyst-run] error", e);
    return json({ error: String(e) }, 500);
  }
});

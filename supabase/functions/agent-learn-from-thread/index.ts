// Phase 16 — Learn from production threads.
// Actions:
//   - promote_to_eval: take a classified thread, anonymize PII, create an agent_evals row.
//   - request_patch: anonymize the thread and send it to ai-builder copilot_chat asking for a patch.
import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";

const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g;
const EMAIL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const CPF_RE = /(\d{3}\.\d{3}\.\d{3}-\d{2})/g;

function anonymize(text: string): string {
  if (!text) return "";
  return text
    .replace(EMAIL_RE, "[email]")
    .replace(CPF_RE, "[cpf]")
    .replace(PHONE_RE, "[telefone]");
}

type MessageRow = {
  id: string;
  from_me: boolean;
  content: string | null;
  message_type: string;
  timestamp: string;
};

async function loadAnonymizedThread(supabase: ReturnType<typeof sb>, leadId: string, limit = 40) {
  const { data: msgs, error } = await supabase
    .from("messages")
    .select("id, from_me, content, message_type, timestamp")
    .eq("lead_id", leadId)
    .order("timestamp", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const rows = (msgs ?? []) as MessageRow[];
  return rows
    .filter((m) => m.message_type === "text" && (m.content ?? "").trim())
    .map((m) => ({
      role: m.from_me ? "assistant" : "user",
      content: anonymize(String(m.content ?? "")),
    }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const supabase = sb();
  try {
    const body = await req.json();
    const action = String(body?.action ?? "");
    const classificationId = body?.classification_id as string | undefined;
    if (!classificationId) return json({ error: "classification_id required" }, 400);

    const { data: cls, error: clsErr } = await supabase
      .from("lead_thread_classifications")
      .select("*")
      .eq("id", classificationId)
      .maybeSingle();
    if (clsErr) throw clsErr;
    if (!cls) return json({ error: "Classification not found" }, 404);

    const thread = await loadAnonymizedThread(supabase, cls.lead_id);
    if (thread.length === 0) return json({ error: "Conversa sem mensagens de texto." }, 400);

    if (action === "promote_to_eval") {
      if (!cls.agent_id) return json({ error: "Classification needs an agent_id to promote." }, 400);
      // last user message = the prompt to replay; previous assistant message stored as hint.
      const lastUser = [...thread].reverse().find((m) => m.role === "user");
      if (!lastUser) return json({ error: "Sem mensagem do lead para virar eval." }, 400);
      const promptHeader = thread
        .slice(-6, -1)
        .map((m) => `${m.role === "user" ? "Lead" : "Bot"}: ${m.content}`)
        .join("\n");
      const prompt = promptHeader
        ? `Contexto da conversa real (anonimizada):\n${promptHeader}\n\nLead: ${lastUser.content}`
        : lastUser.content;

      const { data: evalRow, error: evalErr } = await supabase
        .from("agent_evals")
        .insert({
          agent_id: cls.agent_id,
          clinic_id: cls.clinic_id,
          prompt,
          expected_contains: [],
        })
        .select()
        .single();
      if (evalErr) throw evalErr;

      await supabase
        .from("lead_thread_classifications")
        .update({ promoted_eval_id: evalRow.id })
        .eq("id", cls.id);

      return json({ ok: true, eval_id: evalRow.id });
    }

    if (action === "request_patch") {
      if (!cls.agent_id) return json({ error: "Classification needs an agent_id." }, 400);
      const { data: agent, error: agentErr } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("id", cls.agent_id)
        .maybeSingle();
      if (agentErr) throw agentErr;
      if (!agent) return json({ error: "Agente não encontrado." }, 404);

      const transcript = thread.map((m) => `${m.role === "user" ? "Lead" : "Bot"}: ${m.content}`).join("\n");
      const noteLine = cls.note ? `\nObservação do humano: ${cls.note}` : "";
      const userMsg =
        `Analise esta conversa real marcada como "${cls.label}" (PII anonimizada) e proponha um patch para o agente evitar esse problema no futuro.${noteLine}\n\n--- CONVERSA ---\n${transcript}\n--- FIM ---`;

      const { data: builderResp, error: builderErr } = await supabase.functions.invoke("ai-builder", {
        body: {
          action: "copilot_chat",
          clinic_id: cls.clinic_id,
          payload: {
            agent,
            history: [{ role: "user", content: userMsg }],
          },
        },
      });
      if (builderErr) throw builderErr;
      return json({ ok: true, proposal: builderResp });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

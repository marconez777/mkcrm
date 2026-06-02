// ai-builder — Construtor de Agentes (Fase 1)
// Actions disponíveis nesta fase:
//   - ping: testa conectividade com o provedor usando a api_key do Builder.
//   - generate_system_prompt: stub que retorna um prompt baseline já contendo a
//     cláusula de contexto do lead. Será refinado na Fase 3.

import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";
import { chatCompletion, type Agent } from "../_shared/ai.ts";
import { buildBuilderSystemPrompt, LEAD_CONTEXT_CLAUSE } from "../_shared/builder-system-prompt.ts";

type Action = "ping" | "generate_system_prompt";

interface Body {
  action: Action;
  clinic_id?: string;
  payload?: Record<string, unknown>;
  // Overrides usados pelo wizard /ai/agents/new para testar a conexão do agente
  // que está sendo criado (pode ser diferente do Builder da clínica).
  provider?: string;
  api_key?: string;
  base_url?: string | null;
  model?: string;
}

async function loadBuilder(clinic_id: string): Promise<Agent | null> {
  const supabase = sb();
  const { data } = await supabase
    .from("ai_agents")
    .select("*")
    .eq("clinic_id", clinic_id)
    .eq("system_key", "builder")
    .maybeSingle();
  return (data as Agent | null) ?? null;
}

function parseProviderError(err: unknown): { code: string; message: string; status: number } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes("401") || lower.includes("invalid api key") || lower.includes("incorrect api key") || lower.includes("unauthorized")) {
    return { code: "invalid_key", status: 401, message: "Chave de API inválida. Verifique se copiou a chave completa do seu provedor." };
  }
  if (lower.includes("insufficient_quota") || lower.includes("402") || lower.includes("payment required") || lower.includes("billing")) {
    return { code: "no_credit", status: 402, message: "Sua conta no provedor está sem crédito. Adicione saldo e tente de novo." };
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return { code: "rate_limit", status: 429, message: "Limite de requisições do provedor. Tente novamente em alguns segundos." };
  }
  if (lower.includes("model") && (lower.includes("not found") || lower.includes("does not exist") || lower.includes("unknown"))) {
    return { code: "model_not_found", status: 400, message: "Modelo configurado não foi encontrado no provedor. Escolha outro modelo." };
  }
  if (lower.includes("timeout") || lower.includes("network")) {
    return { code: "network", status: 503, message: "Não consegui falar com o provedor. Cheque sua conexão ou a Base URL." };
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504")) {
    return { code: "provider_down", status: 503, message: "Provedor instável no momento. Tente novamente em alguns instantes." };
  }
  return { code: "unknown", status: 500, message: `Erro ao falar com o provedor: ${raw.slice(0, 240)}` };
}

async function actionPing(builder: Agent, persistVerified: boolean) {
  if (!builder.api_key) {
    return { ok: false, code: "missing_key", message: "Adicione uma chave de API ao Construtor antes de testar." };
  }
  const started = Date.now();
  try {
    const resp = await chatCompletion(
      builder,
      [
        { role: "system", content: "Responda apenas 'ok'." },
        { role: "user", content: "ping" },
      ],
      { max_tokens: 8, temperature: 0 },
      { agent_id: builder.id, note: "ai-builder:ping" },
    );
    const latency_ms = Date.now() - started;
    const text = resp?.choices?.[0]?.message?.content ?? "";

    if (persistVerified) {
      const supabase = sb();
      await supabase
        .from("ai_agents")
        .update({ builder_verified_at: new Date().toISOString() })
        .eq("id", builder.id);
    }

    return {
      ok: true,
      latency_ms,
      model: builder.model,
      provider: builder.provider,
      sample: text.slice(0, 64),
    };
  } catch (e) {
    const parsed = parseProviderError(e);
    return { ok: false, ...parsed };
  }
}

async function actionGenerateSystemPromptStub(payload: Record<string, unknown>) {
  // Fase 1: stub determinístico — não chama LLM ainda.
  // Fase 3 vai substituir isso pela chamada real ao Builder com tool-calling.
  const niche = String(payload.niche ?? "geral");
  const goal = String(payload.goal ?? "atendimento");
  const businessName = String(payload.business_name ?? "seu negócio");

  const system_prompt = `\
Você é um agente de IA de **${goal}** para **${businessName}** (nicho: ${niche}).

Seu objetivo é atender e qualificar leads de forma natural, sem soar robótico.

${LEAD_CONTEXT_CLAUSE}

**Estilo:** português brasileiro, frases curtas, uma ideia por mensagem.

**Princípios:**
- Nunca invente informações que não estejam na sua base de conhecimento.
- Use as ferramentas disponíveis para registrar dados, mover o lead de estágio, agendar mensagens e transferir para humano quando necessário.
- Quando não souber algo, diga que vai verificar — não chute.

**Próximos passos (este prompt será refinado pela entrevista na Fase 3 do Construtor):**
- Definir oferta dominante a propor primeiro.
- Definir tom (formal, próximo ou descontraído).
- Definir tabu (o que nunca pode ser dito).
- Definir critérios de qualificação.
`;

  return {
    ok: true,
    system_prompt,
    suggested_tools: [
      "move_lead_stage",
      "set_lead_field",
      "add_lead_note",
      "transfer_to_human",
      "schedule_message",
      "search_knowledge_base",
    ],
    suggested_temperature: 0.4,
    suggested_top_k: 6,
    suggested_max_iterations: 6,
    rationale: "Stub Fase 1 — Fase 3 vai gerar via LLM usando as respostas da entrevista.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  if (!body.action) return json({ error: "action é obrigatório" }, 400);
  if (!body.clinic_id) return json({ error: "clinic_id é obrigatório" }, 400);

  const builder = await loadBuilder(body.clinic_id);
  if (!builder) {
    return json({ error: "Construtor não provisionado para esta clínica." }, 404);
  }

  try {
    switch (body.action) {
      case "ping": {
        const result = await actionPing(builder);
        return json(result, result.ok ? 200 : (result as { status?: number }).status ?? 400);
      }
      case "generate_system_prompt": {
        // Garante que o Builder está pronto (não vai gerar prompt sem chave válida no futuro)
        if (!builder.api_key) {
          return json({ error: "Configure a chave de API do Construtor antes de gerar prompts." }, 400);
        }
        // Carrega o manual (não usado no stub, mas mantém o I/O quente para Fase 3)
        await buildBuilderSystemPrompt();
        const result = await actionGenerateSystemPromptStub(body.payload ?? {});
        return json(result);
      }
      default:
        return json({ error: `action desconhecida: ${body.action}` }, 400);
    }
  } catch (e) {
    console.error("ai-builder error:", e);
    const parsed = parseProviderError(e);
    return json({ ok: false, ...parsed }, parsed.status);
  }
});

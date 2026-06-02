// AI chat with advanced RAG, MCP tools, parallel tool calls, citations.
// Hardening: tool budget, duplicate-call detection, partial-failure handling, traces, timeouts.
import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";
import { chatCompletion, embed, type Agent, type ChatMessage } from "../_shared/ai.ts";
import { logUsage } from "../_shared/metrics.ts";
import { assertSpendAllowed, SpendLimitExceeded } from "../_shared/spend-guard.ts";
import { retrieveContext, formatContext } from "../_shared/rag.ts";
import { listMcpTools, callMcpTool, toOpenAITools, type McpTool } from "../_shared/mcp.ts";
import { stableStringify, withTimeout, pmap, logTrace } from "../_shared/utils.ts";

const BUILTIN_TOOLS: Record<string, any> = {
  move_lead_stage: {
    type: "function",
    function: {
      name: "move_lead_stage",
      description: "Move o lead atual para outro estágio do funil pelo nome do estágio.",
      parameters: { type: "object", properties: { stage_name: { type: "string" } }, required: ["stage_name"] },
    },
  },
  add_lead_note: {
    type: "function",
    function: {
      name: "add_lead_note",
      description: "Anota uma observação no lead atual.",
      parameters: { type: "object", properties: { note: { type: "string" } }, required: ["note"] },
    },
  },
  set_lead_field: {
    type: "function",
    function: {
      name: "set_lead_field",
      description: "Atualiza um campo simples do lead.",
      parameters: {
        type: "object",
        properties: {
          field: { type: "string", enum: ["name", "email", "company", "deal_value"] },
          value: { type: "string" },
        },
        required: ["field", "value"],
      },
    },
  },
  assign_attendant: {
    type: "function",
    function: {
      name: "assign_attendant",
      description: "Atribui o lead a um atendente pelo nome.",
      parameters: { type: "object", properties: { attendant_name: { type: "string" } }, required: ["attendant_name"] },
    },
  },
  search_knowledge_base: {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Busca explicitamente na base de conhecimento por uma consulta específica e retorna trechos relevantes.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  create_task: {
    type: "function",
    function: {
      name: "create_task",
      description: "Cria uma tarefa para o lead com prazo (ISO 8601).",
      parameters: {
        type: "object",
        properties: { title: { type: "string" }, due_at: { type: "string", description: "ISO 8601" } },
        required: ["title", "due_at"],
      },
    },
  },
  schedule_message: {
    type: "function",
    function: {
      name: "schedule_message",
      description: "Agenda uma mensagem para o lead em data futura.",
      parameters: {
        type: "object",
        properties: { text: { type: "string" }, send_at: { type: "string", description: "ISO 8601" } },
        required: ["text", "send_at"],
      },
    },
  },
  get_lead_history: {
    type: "function",
    function: {
      name: "get_lead_history",
      description: "Retorna as últimas N mensagens trocadas com o lead.",
      parameters: { type: "object", properties: { limit: { type: "number", default: 20 } } },
    },
  },
  transfer_to_human: {
    type: "function",
    function: {
      name: "transfer_to_human",
      description: "Pausa o atendimento automático e indica que o lead precisa de um atendente humano.",
      parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] },
    },
  },
  update_custom_field: {
    type: "function",
    function: {
      name: "update_custom_field",
      description: "Atualiza um campo customizado do lead.",
      parameters: {
        type: "object",
        properties: { key: { type: "string" }, value: { type: "string" } },
        required: ["key", "value"],
      },
    },
  },
  remember_fact: {
    type: "function",
    function: {
      name: "remember_fact",
      description: "Salva uma informação durável sobre o lead na memória persistente do agente. Use sempre que identificar objeções, dúvidas, interesses, motivos de sumiço, comportamento, preferências, perfil, concorrentes, sensibilidade a preço ou gatilhos relevantes para futuras análises de copy/script e treinamento de outros agentes.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [
              "fact",
              "preference",
              "objection",
              "doubt",
              "interest",
              "drop_off",
              "behavior",
              "profile",
              "competitor",
              "price_sensitivity",
              "trigger",
            ],
            description: "Categoria taxonômica do fato (use a mais específica possível).",
          },
          content: { type: "string", description: "Frase auto-contida, factual e não duplicada (ex.: 'Lead disse que valor de R$1.200 está acima do orçamento dele').",
          },
        },
        required: ["kind", "content"],
      },
    },
  },
  add_lead_tag: {
    type: "function",
    function: {
      name: "add_lead_tag",
      description: "Adiciona uma tag ao lead atual (ex.: 'quente', 'frio', 'risco', 'interesse:cetamina').",
      parameters: { type: "object", properties: { tag: { type: "string" } }, required: ["tag"] },
    },
  },
  remove_lead_tag: {
    type: "function",
    function: {
      name: "remove_lead_tag",
      description: "Remove uma tag do lead atual.",
      parameters: { type: "object", properties: { tag: { type: "string" } }, required: ["tag"] },
    },
  },
  get_lead_state: {
    type: "function",
    function: {
      name: "get_lead_state",
      description: "Retorna o estado atual do lead: etapa atual, etapa anterior, tags, campos customizados e timestamp da última mensagem.",
      parameters: { type: "object", properties: {} },
    },
  },
  generate_insight_report: {
    type: "function",
    function: {
      name: "generate_insight_report",
      description: "Consolida a análise da conversa em um relatório estruturado de inteligência comercial (objeções, dúvidas, interesses, motivos de sumiço, recomendações). Use APENAS uma vez por execução, após chamar remember_fact para os fatos individuais. Silencioso — não gera mensagem para o lead.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Resumo de 1-2 frases do estado atual do lead e da conversa." },
          sentiment: { type: "string", enum: ["positivo", "neutro", "negativo", "ambivalente"] },
          top_objections: { type: "array", items: { type: "string" }, description: "Objeções/barreiras identificadas (preço, medo, conjugue, tempo, etc.)." },
          top_doubts: { type: "array", items: { type: "string" }, description: "Dúvidas recorrentes ou não resolvidas." },
          top_interests: { type: "array", items: { type: "string" }, description: "O que o lead mais busca/deseja." },
          drop_off_reasons: { type: "array", items: { type: "string" }, description: "Hipóteses do motivo de sumiço/desengajamento." },
          recommendations: { type: "array", items: { type: "string" }, description: "Sugestões acionáveis para melhorar script, copy ou abordagem." },
          period_start: { type: "string", description: "ISO 8601 — início do período coberto pela análise." },
          period_end: { type: "string", description: "ISO 8601 — fim do período coberto." },
        },
        required: ["summary"],
      },
    },
  },
};

async function executeTool(name: string, args: any, ctx: { leadId: string | null; agent: any; supabase: any }) {
  const { leadId, agent, supabase } = ctx;
  try {
    if (name === "move_lead_stage") {
      if (!leadId) return { error: "no lead context" };
      const { data: leadRow } = await supabase.from("leads").select("pipeline_id, stage_id").eq("id", leadId).single();
      let q = supabase.from("pipeline_stages").select("id, name, pipeline_id").ilike("name", args.stage_name);
      if (leadRow?.pipeline_id) q = q.eq("pipeline_id", leadRow.pipeline_id);
      const { data: stages } = await q.limit(2);
      const stage = stages?.[0];
      if (!stage) {
        const { data: avail } = await supabase.from("pipeline_stages").select("name").eq("pipeline_id", leadRow?.pipeline_id ?? "00000000-0000-0000-0000-000000000000");
        return { error: `stage not found: ${args.stage_name}`, available_stages: (avail ?? []).map((s: any) => s.name) };
      }
      if (leadRow?.stage_id === stage.id) return { ok: true, stage: stage.name, unchanged: true };
      await supabase.from("leads").update({ stage_id: stage.id, stage_changed_at: new Date().toISOString() }).eq("id", leadId);
      await supabase.from("lead_events").insert({
        lead_id: leadId, type: "stage_changed_by_ai",
        payload: { from: leadRow?.stage_id, to: stage.id, agent_id: agent.id, agent_name: agent.name },
      });
      return { ok: true, stage: stage.name };
    }
    if (name === "add_lead_note") {
      if (!leadId) return { error: "no lead context" };
      const { data: lead } = await supabase.from("leads").select("notes").eq("id", leadId).single();
      const merged = (lead?.notes ? lead.notes + "\n\n" : "") + `[IA] ${args.note}`;
      await supabase.from("leads").update({ notes: merged }).eq("id", leadId);
      return { ok: true };
    }
    if (name === "set_lead_field") {
      if (!leadId) return { error: "no lead context" };
      const allowed = ["name", "email", "company", "deal_value"];
      if (!allowed.includes(args.field)) return { error: "field not allowed" };
      const value = args.field === "deal_value" ? Number(args.value) || 0 : args.value;
      await supabase.from("leads").update({ [args.field]: value }).eq("id", leadId);
      return { ok: true };
    }
    if (name === "assign_attendant") {
      if (!leadId) return { error: "no lead context" };
      const { data: att } = await supabase.from("attendants").select("id, name").ilike("name", args.attendant_name).maybeSingle();
      if (!att) return { error: `attendant not found: ${args.attendant_name}` };
      await supabase.from("leads").update({ attendant_id: att.id }).eq("id", leadId);
      return { ok: true, attendant: att.name };
    }
    if (name === "search_knowledge_base") {
      const r = await retrieveContext({ supabase, agent, query: args.query, history: [], leadId });
      return { results: r.chunks.map((c, i) => ({ idx: i + 1, title: c.doc_title, snippet: c.content.slice(0, 400) })) };
    }
    if (name === "create_task") {
      if (!leadId) return { error: "no lead context" };
      const { data, error } = await supabase.from("lead_tasks").insert({ lead_id: leadId, title: args.title, due_at: args.due_at }).select("id").single();
      if (error) return { error: error.message };
      return { ok: true, id: data.id };
    }
    if (name === "schedule_message") {
      if (!leadId) return { error: "no lead context" };
      const { data, error } = await supabase.from("scheduled_messages").insert({ lead_id: leadId, content: args.text, send_at: args.send_at }).select("id").single();
      if (error) return { error: error.message };
      return { ok: true, id: data.id };
    }
    if (name === "get_lead_history") {
      if (!leadId) return { error: "no lead context" };
      const limit = Math.min(Number(args.limit) || 20, 50);
      const { data } = await supabase.from("messages")
        .select("from_me, content, message_type, timestamp")
        .eq("lead_id", leadId).order("timestamp", { ascending: false }).limit(limit);
      return { messages: (data ?? []).reverse().map((m: any) => ({ role: m.from_me ? "atendente" : "cliente", text: m.content, when: m.timestamp })) };
    }
    if (name === "transfer_to_human") {
      if (!leadId) return { error: "no lead context" };
      const until = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
      await supabase.from("lead_ai_settings").upsert({ lead_id: leadId, agent_id: agent.id, paused_until: until, auto_reply: false });
      await supabase.from("lead_internal_notes").insert({ lead_id: leadId, author_name: "IA", text: `Transferido para humano: ${args.reason}` });
      return { ok: true, paused_until: until };
    }
    if (name === "update_custom_field") {
      if (!leadId) return { error: "no lead context" };
      const { data: lead } = await supabase.from("leads").select("custom_fields").eq("id", leadId).single();
      const merged = { ...(lead?.custom_fields ?? {}), [args.key]: args.value };
      await supabase.from("leads").update({ custom_fields: merged }).eq("id", leadId);
      return { ok: true };
    }
    if (name === "remember_fact") {
      try {
        const content = String(args.content ?? "").trim();
        const ALLOWED_KINDS = new Set([
          "fact", "preference", "objection", "doubt", "interest",
          "drop_off", "behavior", "profile", "competitor",
          "price_sensitivity", "trigger",
        ]);
        const rawKind = String(args.kind ?? "fact");
        const kind = ALLOWED_KINDS.has(rawKind) ? rawKind : "fact";
        if (!content) return { error: "empty content" };
        if (!agent.clinic_id) return { error: "missing clinic_id on agent" };
        const [vec] = await embed(agent, [content], { agent_id: agent.id, lead_id: leadId, note: "tool:remember_fact" });
        const { error } = await supabase.from("agent_memory").insert({
          clinic_id: agent.clinic_id,
          agent_id: agent.id,
          lead_id: leadId,
          kind,
          content,
          embedding: vec as any,
        });
        if (error) {
          console.error("[remember_fact] insert error", error);
          return { error: error.message };
        }
        return { ok: true, kind };
      } catch (e) {
        console.error("[remember_fact] exception", e);
        return { error: String(e) };
      }
    }
    if (name === "add_lead_tag") {
      if (!leadId) return { error: "no lead context" };
      const tag = String(args.tag ?? "").trim();
      if (!tag) return { error: "empty tag" };
      const { data: lead } = await supabase.from("leads").select("tags").eq("id", leadId).single();
      const current: string[] = Array.isArray(lead?.tags) ? lead!.tags : [];
      if (current.includes(tag)) return { ok: true, unchanged: true };
      await supabase.from("leads").update({ tags: [...current, tag] }).eq("id", leadId);
      return { ok: true, tags: [...current, tag] };
    }
    if (name === "remove_lead_tag") {
      if (!leadId) return { error: "no lead context" };
      const tag = String(args.tag ?? "").trim();
      const { data: lead } = await supabase.from("leads").select("tags").eq("id", leadId).single();
      const current: string[] = Array.isArray(lead?.tags) ? lead!.tags : [];
      const next = current.filter((t) => t !== tag);
      if (next.length === current.length) return { ok: true, unchanged: true };
      await supabase.from("leads").update({ tags: next }).eq("id", leadId);
      return { ok: true, tags: next };
    }
    if (name === "get_lead_state") {
      if (!leadId) return { error: "no lead context" };
      const { data: lead } = await supabase.from("leads")
        .select("name, stage_id, tags, custom_fields, last_message_at, stage_changed_at, attendant_id")
        .eq("id", leadId).single();
      const { data: stage } = lead?.stage_id
        ? await supabase.from("pipeline_stages").select("name").eq("id", lead.stage_id).single()
        : { data: null };
      const { data: hist } = await supabase.from("lead_stage_history")
        .select("from_stage_id, to_stage_id, moved_at")
        .eq("lead_id", leadId).order("moved_at", { ascending: false }).limit(5);
      let previousStageName: string | null = null;
      const prevId = hist?.find((h: any) => h.from_stage_id && h.from_stage_id !== lead?.stage_id)?.from_stage_id;
      if (prevId) {
        const { data: ps } = await supabase.from("pipeline_stages").select("name").eq("id", prevId).single();
        previousStageName = ps?.name ?? null;
      }
      return {
        name: lead?.name ?? null,
        stage_name: stage?.name ?? null,
        previous_stage_name: previousStageName,
        tags: lead?.tags ?? [],
        custom_fields: lead?.custom_fields ?? {},
        last_message_at: lead?.last_message_at ?? null,
        stage_changed_at: lead?.stage_changed_at ?? null,
        recent_stage_history: hist ?? [],
      };
    }
    if (name === "generate_insight_report") {
      try {
        if (!agent.clinic_id) return { error: "missing clinic_id on agent" };
        const summary = String(args.summary ?? "").trim();
        if (!summary) return { error: "empty summary" };
        const arr = (v: any) => Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
        const validSentiments = ["positivo", "neutro", "negativo", "ambivalente"];
        const sentiment = validSentiments.includes(args.sentiment) ? args.sentiment : null;
        const { data, error } = await supabase.from("ai_insights").insert({
          clinic_id: agent.clinic_id,
          agent_id: agent.id,
          lead_id: leadId,
          summary,
          sentiment,
          top_objections: arr(args.top_objections),
          top_doubts: arr(args.top_doubts),
          top_interests: arr(args.top_interests),
          drop_off_reasons: arr(args.drop_off_reasons),
          recommendations: arr(args.recommendations),
          period_start: args.period_start ?? null,
          period_end: args.period_end ?? new Date().toISOString(),
          raw: args,
        }).select("id").single();
        if (error) {
          console.error("[generate_insight_report] insert error", error);
          return { error: error.message };
        }
        return { ok: true, id: data.id };
      } catch (e) {
        console.error("[generate_insight_report] exception", e);
        return { error: String(e) };
      }
    }
    return { error: `unknown tool: ${name}` };
  } catch (e) {
    return { error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const supabase = sb();

  try {
    const {
      agent_id,
      messages: incomingRaw = [],
      lead_id = null,
      thread_id = null,
      persist = false,
      simulated_lead = null,
    } = await req.json();
    if (!agent_id) return json({ error: "agent_id required" }, 400);

    const { data: agentRow } = await supabase.from("ai_agents").select("*").eq("id", agent_id).single();
    if (!agentRow) return json({ error: "agent not found" }, 404);
    // `enabled=false` só bloqueia atendimento real (com lead_id). Test Lab segue funcionando.
    if (!agentRow.enabled && lead_id) return json({ error: "Agente desativado. Ative-o para atender leads." }, 400);
    if (agentRow.draft_mode && lead_id) {
      return json({ error: "Agente em modo rascunho: só responde no Test Lab. Publique para atender leads." }, 423);
    }
    if (!agentRow.api_key) return json({ error: "Agente sem chave de API configurada. Edite o agente e cole a chave no passo de provedor." }, 400);
    const agent = agentRow as Agent & any;

    // Fase 10 — Lead simulado (Test Lab apenas: só vale quando lead_id está ausente)
    let simulatedLeadCtx = "";
    if (!lead_id && simulated_lead && typeof simulated_lead === "object") {
      const sl = simulated_lead as Record<string, any>;
      const name = String(sl.name ?? "").trim();
      const phone = String(sl.phone ?? "").trim();
      const channel = String(sl.channel ?? "whatsapp").trim();
      const pipeline = String(sl.pipeline ?? "").trim();
      const stage = String(sl.stage ?? "").trim();
      const customFields = sl.custom_fields && typeof sl.custom_fields === "object" ? sl.custom_fields : null;
      const notes = String(sl.notes ?? "").trim();
      const parts: string[] = [];
      if (name) parts.push(`nome=${name}`);
      if (phone) parts.push(`telefone=${phone}`);
      if (channel) parts.push(`canal=${channel}`);
      if (pipeline) parts.push(`funil=${pipeline}`);
      if (stage) parts.push(`etapa=${stage}`);
      if (customFields && Object.keys(customFields).length) parts.push(`campos=${JSON.stringify(customFields)}`);
      if (notes) parts.push(`observacoes=${notes}`);
      if (parts.length) {
        simulatedLeadCtx =
          `\n\n## Contexto do lead (simulação Test Lab)\n` +
          parts.map((p) => `- ${p}`).join("\n") +
          `\n\nIMPORTANTE: estes dados já chegaram com o lead (vindo do WhatsApp/canal). ` +
          `NÃO peça nome, telefone ou dados que já estão acima. ` +
          `Responda em estilo ping-pong: mensagens curtas, 1 pergunta de cada vez, sem floreios.`;
      }
    }

    await assertSpendAllowed(agent.clinic_id ?? null);

    // Manual review path: lead_id sem mensagens => carrega últimas 30 mensagens reais como turno único do user
    let incoming = incomingRaw;
    if (lead_id && (!incoming || incoming.length === 0)) {
      const { data: msgs } = await supabase.from("messages")
        .select("from_me, content, message_type, timestamp")
        .eq("lead_id", lead_id).order("timestamp", { ascending: false }).limit(30);
      const ordered = (msgs ?? []).reverse().filter((m: any) => m.content);
      const transcript = ordered.map((m: any) => {
        const when = new Date(m.timestamp).toISOString().slice(11, 16);
        const who = m.from_me ? "atendente" : "lead";
        return `[${who} ${when}] ${m.content}`;
      }).join("\n");
      incoming = [{ role: "user", content: `Revise a conversa abaixo e tome as ações cabíveis (mover etapa, tags, notas, tarefas). Não responda ao lead — apenas use ferramentas.\n\n---\n${transcript || "(sem mensagens)"}\n---` }];
    }

    // RAG: advanced retrieval
    const lastUser = [...incoming].reverse().find((m: any) => m.role === "user");
    let ragContext = "";
    let sources: any[] = [];
    if (lastUser?.content) {
      try {
        const r = await retrieveContext({ supabase, agent, query: lastUser.content, history: incoming, leadId: lead_id });
        ragContext = formatContext(r);
        sources = r.chunks.map((c, i) => ({ idx: i + 1, doc_id: c.document_id, title: c.doc_title, snippet: c.content.slice(0, 200), score: c.score }));
      } catch (e) { console.error("RAG error", e); }
    }

    // Lead context
    let leadCtx = "";
    if (lead_id) {
      const { data: lead } = await supabase.from("leads")
        .select("name, phone, email, company, deal_value, notes, tags, stage_id, pipeline_id, custom_fields").eq("id", lead_id).single();
      if (lead) {
        const { data: stage } = lead.stage_id
          ? await supabase.from("pipeline_stages").select("name").eq("id", lead.stage_id).single()
          : { data: null };
        let stagesList = "";
        if (lead.pipeline_id) {
          const { data: allStages } = await supabase.from("pipeline_stages")
            .select("name, position").eq("pipeline_id", lead.pipeline_id).order("position");
          if (allStages?.length) {
            stagesList = `\n\n## Estágios disponíveis no funil (use exatamente um destes nomes em move_lead_stage)\n` +
              allStages.map((s: any) => `- ${s.name}`).join("\n");
          }
        }

        // Custom field schema for the clinic — required for update_custom_field tool
        let customFieldsBlock = "";
        const { data: defs } = await supabase.from("lead_custom_fields")
          .select("field_key, label, field_type, options")
          .eq("clinic_id", agentRow.clinic_id).order("position");
        if (defs?.length) {
          const lines = defs.map((d: any) => {
            const opts = Array.isArray(d.options) && d.options.length
              ? ` | opções: ${d.options.join(" | ")}`
              : "";
            const hint =
              d.field_type === "datetime" ? " (ISO 8601, ex.: 2026-05-15T14:00:00-03:00)" :
              d.field_type === "date" ? " (YYYY-MM-DD)" :
              d.field_type === "boolean" ? " (true/false)" :
              d.field_type === "currency" || d.field_type === "number" ? " (número puro)" :
              d.field_type === "multiselect" ? " (array de strings, use SOMENTE opções listadas)" :
              d.field_type === "select" ? " (string, use SOMENTE uma das opções listadas)" :
              "";
            return `- ${d.field_key} — ${d.label} (${d.field_type}${hint})${opts}`;
          }).join("\n");
          const cur = lead.custom_fields ?? {};
          customFieldsBlock =
            `\n\n## Campos personalizados disponíveis (use EXATAMENTE estas keys em update_custom_field)\n${lines}` +
            `\n\n### Valores atuais\n${JSON.stringify(cur)}`;
        }

        const { custom_fields: _cf, ...leadRest } = lead as any;
        // Compact JSON (no indent) — saves ~15-25% tokens per turn on lead context.
        leadCtx = `\n\n## Lead atual\n${JSON.stringify({ ...leadRest, stage: stage?.name })}${stagesList}${customFieldsBlock}`;
      }
    }

    // Built-in tools (selected by agent)
    const enabledNames = new Set<string>(agentRow.tools as string[]);
    const builtins = [...enabledNames].map((t) => BUILTIN_TOOLS[t]).filter(Boolean);

    // MCP tools
    let mcpTools: McpTool[] = [];
    try {
      const { data: servers } = await supabase.from("agent_mcp_servers")
        .select("id, name, url, headers").eq("agent_id", agent_id).eq("enabled", true);
      if (servers && servers.length > 0) {
        mcpTools = await listMcpTools(servers.map((s: any) => ({ id: s.id, name: s.name, url: s.url, headers: s.headers ?? {} })));
      }
    } catch (e) { console.error("MCP list error", e); }

    const tools = [...builtins, ...toOpenAITools(mcpTools)];

    // Planning prefix
    const planning = agent.planning_mode
      ? "\n\nAntes de responder, pense em passos: (1) o que o usuário quer? (2) que ferramentas ou trechos da base ajudam? (3) execute. (4) revise e responda objetivamente."
      : "";

    // Fase 14b — Classificador de estágios (Test Lab apenas: lead_id ausente).
    // Em produção, estágios ficam dormentes até a fase 14c (toggle por agente).
    let stageCtx = "";
    let stageMeta: {
      stage_id: string | null;
      name: string | null;
      reason: string | null;
      delta_excerpt: string | null;
      all_stages: Array<{ id: string; name: string; advance_when: string | null }>;
    } | null = null;
    if (!lead_id) {
      try {
        const { data: stageRows } = await supabase
          .from("agent_stages")
          .select("id, name, goal, system_prompt_delta, advance_when, order_idx")
          .eq("agent_id", agent_id)
          .order("order_idx", { ascending: true });
        const stages = stageRows ?? [];
        if (stages.length > 0) {
          const tail = incoming.slice(-12).map((m: any) => {
            const who = m.role === "user" ? "lead" : m.role === "assistant" ? "agente" : m.role;
            return `[${who}] ${String(m.content ?? "").slice(0, 400)}`;
          }).join("\n");
          const stageList = stages.map((s: any, i: number) =>
            `${i + 1}. ${s.name}${s.goal ? ` — objetivo: ${s.goal}` : ""}${s.advance_when ? ` — avança quando: ${s.advance_when}` : ""}`,
          ).join("\n");
          const classifierMsgs: ChatMessage[] = [
            { role: "system", content:
              `Você é um classificador de estágio de conversa de vendas. Dada a lista de estágios numerados e o histórico recente, escolha o ESTÁGIO ATUAL (o primeiro estágio cujo "avança quando" ainda NÃO foi satisfeito). Responda APENAS um JSON: {"stage_index": <1-${stages.length}>, "reason": "<1 frase curta>"}. Sem markdown, sem texto extra.` },
            { role: "user", content: `Estágios:\n${stageList}\n\nHistórico (mais recente por último):\n${tail || "(vazio — primeira mensagem)"}` },
          ];
          const cls = await chatCompletion(
            { ...agent, max_iterations: 1 } as any,
            classifierMsgs,
            undefined,
            { agent_id, lead_id: null, thread_id, note: "stage:classify" },
          );
          let chosenIdx = 1;
          let reason = "(primeiro estágio por padrão)";
          if (cls.ok) {
            const raw = cls.choices?.[0]?.message?.content ?? "";
            try {
              const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
              const n = Number(parsed.stage_index);
              if (n >= 1 && n <= stages.length) chosenIdx = n;
              if (typeof parsed.reason === "string") reason = parsed.reason.slice(0, 240);
            } catch { /* fallback */ }
          }
          const chosen: any = stages[chosenIdx - 1];
          const delta = String(chosen?.system_prompt_delta ?? "").trim();
          stageCtx = `\n\n## Estágio atual da conversa: "${chosen.name}" (${chosenIdx}/${stages.length})\n` +
            (chosen.goal ? `Objetivo deste estágio: ${chosen.goal}\n` : "") +
            (delta ? `\n${delta}\n` : "") +
            `\nFoque NESTE estágio. Avance só quando: ${chosen.advance_when || "(critério não definido)"}.`;
          stageMeta = {
            stage_id: chosen.id,
            name: chosen.name,
            reason,
            delta_excerpt: delta ? delta.slice(0, 600) : null,
            all_stages: stages.map((s: any) => ({ id: s.id, name: s.name, advance_when: s.advance_when ?? null })),
          };
        }
      } catch (e) {
        console.error("[stages] classifier failed", e);
      }
    }

    const sysContent =
      agentRow.system_prompt +
      planning +
      leadCtx +
      simulatedLeadCtx +
      stageCtx +
      ragContext +
      "\n\nQuando usar trechos da base, cite com [1], [2] etc.";

    const sysPrompt: ChatMessage = { role: "system", content: sysContent };
    const conv: ChatMessage[] = [sysPrompt, ...incoming];

    let finalContent = "";
    const usedTools: any[] = [];
    let totalIn = 0, totalOut = 0, totalTok = 0;
    const startedAt = Date.now();
    const runId = crypto.randomUUID();
    const maxIter = Math.min(Math.max(Number(agent.max_iterations) || 6, 1), 12);
    const maxToolCalls = Math.min(Math.max(Number(agent.max_tool_calls) || 12, 1), 50);
    const TURN_TIMEOUT_MS = 90_000;
    const TOOL_TIMEOUT_MS = 15_000;

    const callCounter = new Map<string, number>();
    let toolCallsTotal = 0;
    let step = 0;
    let stoppedReason: string | null = null;

    for (let iter = 0; iter < maxIter; iter++) {
      if (Date.now() - startedAt > TURN_TIMEOUT_MS) { stoppedReason = "turn_timeout"; break; }

      const llmStart = Date.now();
      const budgetExhausted = toolCallsTotal >= maxToolCalls;
      const resp = await chatCompletion(
        agent, conv,
        budgetExhausted ? undefined : (tools.length > 0 ? tools : undefined),
        { agent_id, lead_id, thread_id, note: `iter:${iter}` },
      );
      await logTrace(supabase, {
        run_id: runId, agent_id, thread_id, lead_id, step: step++, kind: "llm", name: agent.model,
        latency_ms: Date.now() - llmStart, tokens_in: resp.usage?.prompt_tokens ?? null, tokens_out: resp.usage?.completion_tokens ?? null,
        error: resp.ok ? null : `${resp.status}`,
      });
      if (!resp.ok) {
        // chatCompletion auto-logs the error to ai_usage when ctx is provided.
        return json({ error: `${agent.provider} error ${resp.status}`, detail: resp.errorText?.slice(0, 400) }, 502);
      }
      const u = resp.usage;
      if (u) { totalIn += u.prompt_tokens ?? 0; totalOut += u.completion_tokens ?? 0; totalTok += u.total_tokens ?? 0; }
      const choice = resp.choices?.[0]?.message;
      if (!choice) break;

      if (choice.tool_calls && choice.tool_calls.length > 0 && !budgetExhausted) {
        conv.push({ role: "assistant", content: choice.content ?? "", tool_calls: choice.tool_calls });

        const filtered = choice.tool_calls.map((call) => {
          const fname = call.function?.name ?? "";
          let args: any = {};
          try { args = JSON.parse(call.function?.arguments ?? "{}"); } catch {}
          const key = `${fname}:${stableStringify(args)}`;
          const seen = (callCounter.get(key) ?? 0) + 1;
          callCounter.set(key, seen);
          return { call, fname, args, blocked: seen >= 3 };
        });

        const settled = await pmap(filtered, 4, async (item) => {
          if (item.blocked) {
            return { ...item, result: { error: "duplicate_call_blocked", hint: "use o resultado anterior dessa ferramenta" } };
          }
          toolCallsTotal++;
          const toolStart = Date.now();
          let result: any;
          try {
            const mcp = mcpTools.find((t) => t.name === item.fname);
            const exec = mcp
              ? callMcpTool(mcp, item.args).then((output) => ({ ok: true, output }))
              : executeTool(item.fname, item.args, { leadId: lead_id, agent, supabase });
            result = await withTimeout(Promise.resolve(exec), TOOL_TIMEOUT_MS, item.fname);
          } catch (e) {
            result = { error: String(e), retryable: /timeout|network|429|503/i.test(String(e)) };
          }
          await logTrace(supabase, {
            run_id: runId, agent_id, thread_id, lead_id, step: step++, kind: "tool", name: item.fname,
            latency_ms: Date.now() - toolStart, error: result?.error ?? null, payload: { args: item.args },
          });
          return { ...item, result };
        });

        for (const r of settled) {
          usedTools.push({ name: r.fname, args: r.args, result: r.result });
          conv.push({ role: "tool", tool_call_id: r.call.id, name: r.fname, content: JSON.stringify(r.result) });
        }

        if (toolCallsTotal >= maxToolCalls) {
          conv.push({ role: "system", content: "Orçamento de ferramentas atingido. Produza a resposta final agora com o que já tem." });
        }
        continue;
      }
      finalContent = choice.content ?? "";
      break;
    }

    if (!finalContent && stoppedReason) {
      finalContent = "Desculpe, não consegui finalizar a resposta a tempo. Tente reformular.";
    }

    let threadId = thread_id;
    if (persist) {
      if (!threadId) {
        const { data: t } = await supabase.from("ai_threads")
          .insert({ agent_id, lead_id, title: lastUser?.content?.slice(0, 80) ?? "Conversa" })
          .select("id").single();
        threadId = t?.id ?? null;
      }
      if (threadId) {
        const rows = incoming.filter((m: any) => m.role === "user").slice(-1)
          .map((m: any) => ({ thread_id: threadId, role: "user", content: m.content }));
        rows.push({ thread_id: threadId, role: "assistant", content: finalContent });
        await supabase.from("ai_messages").insert(rows);
      }
    }

    // Aggregate "turn summary" row — one per user turn — so the cost dashboard
    // can show "replied" + tools_called alongside the per-iteration rows above.
    await logUsage({
      agent_id, lead_id, thread_id: threadId, model: agent.model,
      input_tokens: totalIn,
      output_tokens: totalOut,
      total_tokens: totalTok || (totalIn + totalOut),
      latency_ms: Date.now() - startedAt, tools_called: usedTools.length,
      replied: !!finalContent, status: "success", error: "turn:summary",
    });

    // Fase 13 — Trace "Alfred" (Test Lab apenas por enquanto)
    const maskPII = (s: string | null | undefined): string => {
      if (!s) return "";
      return s
        .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi, "[email]")
        .replace(/\+?\d[\d\s().-]{7,}\d/g, "[telefone]");
    };
    const traceBody = {
      clinic_id: agentRow.clinic_id,
      agent_id,
      source: "test_lab" as const,
      lead_id: null,
      persona_id: null,
      user_message: maskPII(lastUser?.content ?? "").slice(0, 4000),
      agent_message: maskPII(finalContent).slice(0, 8000),
      system_prompt_excerpt: maskPII(sysContent).slice(0, 4000),
      kb_hits: sources.slice(0, 12),
      tool_calls: usedTools.slice(0, 20).map((t) => ({
        name: t.name,
        args: t.args,
        ok: !t.result?.error,
        error: t.result?.error ?? null,
      })),
      model: agent.model,
      tokens_in: totalIn,
      tokens_out: totalOut,
      latency_ms: Date.now() - startedAt,
    };
    let traceId: string | null = null;
    if (!lead_id) {
      try {
        const { data: traceRow } = await supabase.from("ai_chat_traces").insert(traceBody).select("id").single();
        traceId = traceRow?.id ?? null;
      } catch (e) {
        console.error("ai_chat_traces insert failed", e);
      }
    }

    return json({
      ok: true,
      content: finalContent,
      thread_id: threadId,
      tools_used: usedTools,
      sources,
      trace: !lead_id
        ? {
            id: traceId,
            model: agent.model,
            tokens_in: totalIn,
            tokens_out: totalOut,
            latency_ms: Date.now() - startedAt,
            kb_hits: sources,
            tool_calls: traceBody.tool_calls,
            system_prompt_excerpt: traceBody.system_prompt_excerpt,
          }
        : undefined,
    });
  } catch (e) {
    if (e instanceof SpendLimitExceeded) return json(e.body, 402);
    console.error("ai-chat", e);
    return json({ error: String(e) }, 500);
  }
});

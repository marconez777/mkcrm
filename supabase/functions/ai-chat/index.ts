// AI chat with advanced RAG, MCP tools, parallel tool calls, citations.
// Hardening: tool budget, duplicate-call detection, partial-failure handling, traces, timeouts.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";
import { chatCompletion, embed, type Agent, type ChatMessage } from "../_shared/ai.ts";
import { logUsage } from "../_shared/metrics.ts";
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
      description: "Salva uma informação importante (fato/preferência) sobre o lead na memória persistente do agente.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["fact", "preference"] },
          content: { type: "string" },
        },
        required: ["kind", "content"],
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
        const [vec] = await embed(agent, [args.content]);
        await supabase.from("agent_memory").insert({ agent_id: agent.id, lead_id: leadId, kind: args.kind, content: args.content, embedding: vec as any });
        return { ok: true };
      } catch (e) {
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
  const supabase = sb();

  try {
    const { agent_id, messages: incoming = [], lead_id = null, thread_id = null, persist = false } = await req.json();
    if (!agent_id) return json({ error: "agent_id required" }, 400);

    const { data: agentRow } = await supabase.from("ai_agents").select("*").eq("id", agent_id).single();
    if (!agentRow) return json({ error: "agent not found" }, 404);
    if (!agentRow.enabled) return json({ error: "agent disabled" }, 400);
    // Auto-injetar LOVABLE_API_KEY se o agente aponta para o Lovable AI Gateway sem chave própria
    if (!agentRow.api_key && (agentRow.base_url ?? "").includes("ai.gateway.lovable.dev")) {
      agentRow.api_key = Deno.env.get("LOVABLE_API_KEY") ?? null;
    }
    if (!agentRow.api_key) return json({ error: "Agente sem API key configurada" }, 400);
    const agent = agentRow as Agent & any;

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
        .select("name, phone, email, company, deal_value, notes, tags, stage_id, pipeline_id").eq("id", lead_id).single();
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
        leadCtx = `\n\n## Lead atual\n${JSON.stringify({ ...lead, stage: stage?.name }, null, 2)}${stagesList}`;
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

    const sysContent =
      agentRow.system_prompt +
      planning +
      leadCtx +
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
      );
      await logTrace(supabase, {
        run_id: runId, agent_id, thread_id, lead_id, step: step++, kind: "llm", name: agent.model,
        latency_ms: Date.now() - llmStart, tokens_in: resp.usage?.prompt_tokens ?? null, tokens_out: resp.usage?.completion_tokens ?? null,
        error: resp.ok ? null : `${resp.status}`,
      });
      if (!resp.ok) {
        await logUsage({ agent_id, lead_id, model: agent.model, status: "error", error: `provider ${resp.status}`, latency_ms: Date.now() - startedAt });
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

    await logUsage({
      agent_id, lead_id, thread_id: threadId, model: agent.model,
      input_tokens: totalIn || null, output_tokens: totalOut || null, total_tokens: totalTok || null,
      latency_ms: Date.now() - startedAt, tools_called: usedTools.length,
      replied: !!finalContent, status: "success",
    });

    return json({ ok: true, content: finalContent, thread_id: threadId, tools_used: usedTools, sources });
  } catch (e) {
    console.error("ai-chat", e);
    return json({ error: String(e) }, 500);
  }
});

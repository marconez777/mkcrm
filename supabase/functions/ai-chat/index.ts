// AI chat with RAG and tool calling. Uses per-agent provider + api_key.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";
import { chatCompletion, embed, type Agent, type ChatMessage } from "../_shared/ai.ts";
import { logUsage } from "../_shared/metrics.ts";

const TOOL_DEFINITIONS: Record<string, any> = {
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
      description: "Atualiza um campo simples do lead (name, email, company, deal_value).",
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
};

async function executeTool(name: string, args: any, leadId: string | null) {
  const supabase = sb();
  if (!leadId) return { error: "no lead context" };
  try {
    if (name === "move_lead_stage") {
      const { data: stage } = await supabase.from("pipeline_stages").select("id, name").ilike("name", args.stage_name).maybeSingle();
      if (!stage) return { error: `stage not found: ${args.stage_name}` };
      await supabase.from("leads").update({ stage_id: stage.id }).eq("id", leadId);
      return { ok: true, stage: stage.name };
    }
    if (name === "add_lead_note") {
      const { data: lead } = await supabase.from("leads").select("notes").eq("id", leadId).single();
      const merged = (lead?.notes ? lead.notes + "\n\n" : "") + `[IA] ${args.note}`;
      await supabase.from("leads").update({ notes: merged }).eq("id", leadId);
      return { ok: true };
    }
    if (name === "set_lead_field") {
      const allowed = ["name", "email", "company", "deal_value"];
      if (!allowed.includes(args.field)) return { error: "field not allowed" };
      const value = args.field === "deal_value" ? Number(args.value) || 0 : args.value;
      await supabase.from("leads").update({ [args.field]: value }).eq("id", leadId);
      return { ok: true };
    }
    if (name === "assign_attendant") {
      const { data: att } = await supabase.from("attendants").select("id, name").ilike("name", args.attendant_name).maybeSingle();
      if (!att) return { error: `attendant not found: ${args.attendant_name}` };
      await supabase.from("leads").update({ attendant_id: att.id }).eq("id", leadId);
      return { ok: true, attendant: att.name };
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
    if (!agentRow.api_key) return json({ error: "Agente sem API key configurada" }, 400);
    const agent = agentRow as Agent;

    // RAG
    const lastUser = [...incoming].reverse().find((m: any) => m.role === "user");
    let context = "";
    if (lastUser?.content) {
      try {
        const [vec] = await embed(agent, [lastUser.content]);
        const { data: matches } = await supabase.rpc("match_chunks", {
          query_embedding: vec, p_agent_id: agent_id, match_count: 5,
        });
        if (matches && matches.length > 0) {
          context = "\n\nContexto da base de conhecimento:\n" +
            matches.map((m: any, i: number) => `[${i + 1}] ${m.content}`).join("\n\n");
        }
      } catch (e) { console.error("RAG error", e); }
    }

    let leadCtx = "";
    if (lead_id) {
      const { data: lead } = await supabase.from("leads")
        .select("name, phone, email, company, deal_value, notes, tags, stage_id").eq("id", lead_id).single();
      if (lead) {
        const { data: stage } = lead.stage_id
          ? await supabase.from("pipeline_stages").select("name").eq("id", lead.stage_id).single()
          : { data: null };
        leadCtx = `\n\nLead atual: ${JSON.stringify({ ...lead, stage: stage?.name })}`;
      }
    }

    const tools = (agentRow.tools as string[]).map((t) => TOOL_DEFINITIONS[t]).filter(Boolean);
    const sysPrompt: ChatMessage = { role: "system", content: agentRow.system_prompt + leadCtx + context };
    const conv: ChatMessage[] = [sysPrompt, ...incoming];

    let finalContent = "";
    const usedTools: any[] = [];
    let totalIn = 0, totalOut = 0, totalTok = 0;
    const startedAt = Date.now();

    for (let iter = 0; iter < 5; iter++) {
      const resp = await chatCompletion(agent, conv, tools.length > 0 ? tools : undefined);
      if (!resp.ok) {
        await logUsage({ agent_id, lead_id, model: agent.model, status: "error", error: `provider ${resp.status}`, latency_ms: Date.now() - startedAt });
        return json({ error: `${agent.provider} error ${resp.status}`, detail: resp.errorText?.slice(0, 400) }, 502);
      }
      const u = resp.usage;
      if (u) { totalIn += u.prompt_tokens ?? 0; totalOut += u.completion_tokens ?? 0; totalTok += u.total_tokens ?? 0; }
      const choice = resp.choices?.[0]?.message;
      if (!choice) break;

      if (choice.tool_calls && choice.tool_calls.length > 0) {
        conv.push({ role: "assistant", content: choice.content ?? "", tool_calls: choice.tool_calls });
        for (const call of choice.tool_calls) {
          const args = JSON.parse(call.function?.arguments ?? "{}");
          const result = await executeTool(call.function?.name, args, lead_id);
          usedTools.push({ name: call.function?.name, args, result });
          conv.push({ role: "tool", tool_call_id: call.id, name: call.function?.name, content: JSON.stringify(result) });
        }
        continue;
      }
      finalContent = choice.content ?? "";
      break;
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

    return json({ ok: true, content: finalContent, thread_id: threadId, tools_used: usedTools });
  } catch (e) {
    console.error("ai-chat", e);
    return json({ error: String(e) }, 500);
  }
});

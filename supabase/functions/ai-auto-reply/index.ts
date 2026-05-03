// Auto-reply triggered by webhook on a new inbound message.
// Resolves which agent to use, builds the conversation, calls ai-chat, sends via evolution-send.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const { lead_id } = await req.json();
    if (!lead_id) return json({ error: "lead_id required" }, 400);

    const { data: lead } = await supabase
      .from("leads")
      .select("id, stage_id")
      .eq("id", lead_id)
      .single();
    if (!lead) return json({ error: "lead not found" }, 404);

    // Resolve agent: per-lead first, then per-stage default.
    const { data: leadCfg } = await supabase
      .from("lead_ai_settings")
      .select("agent_id, auto_reply, paused_until")
      .eq("lead_id", lead_id)
      .maybeSingle();

    let agentId: string | null = null;
    let autoReply = false;

    if (leadCfg) {
      autoReply = !!leadCfg.auto_reply;
      agentId = leadCfg.agent_id ?? null;
      if (leadCfg.paused_until && new Date(leadCfg.paused_until).getTime() > Date.now()) {
        return json({ skipped: true, reason: "paused" });
      }
    }

    if ((!agentId || !leadCfg) && lead.stage_id) {
      const { data: stageCfg } = await supabase
        .from("stage_ai_defaults")
        .select("agent_id, auto_reply")
        .eq("stage_id", lead.stage_id)
        .maybeSingle();
      if (stageCfg) {
        if (!leadCfg) autoReply = !!stageCfg.auto_reply;
        if (!agentId) agentId = stageCfg.agent_id;
      }
    }

    if (!autoReply || !agentId) return json({ skipped: true, reason: "not-enabled" });

    // Last 20 messages as context.
    const { data: msgs } = await supabase
      .from("messages")
      .select("from_me, content, message_type")
      .eq("lead_id", lead_id)
      .order("timestamp", { ascending: false })
      .limit(20);
    const ordered = (msgs ?? []).reverse();
    const conv = ordered
      .filter((m) => m.content)
      .map((m) => ({
        role: m.from_me ? "assistant" : "user",
        content: m.content as string,
      }));
    if (conv.length === 0 || conv[conv.length - 1].role !== "user") {
      return json({ skipped: true, reason: "no-user-msg" });
    }

    // Find or create thread
    let { data: thread } = await supabase
      .from("ai_threads")
      .select("id")
      .eq("lead_id", lead_id)
      .eq("agent_id", agentId)
      .maybeSingle();
    if (!thread) {
      const { data: t } = await supabase
        .from("ai_threads")
        .insert({ lead_id, agent_id: agentId, title: "Auto-resposta" })
        .select("id")
        .single();
      thread = t;
    }

    // Call ai-chat
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      },
      body: JSON.stringify({
        agent_id: agentId,
        lead_id,
        thread_id: thread?.id,
        persist: true,
        messages: conv,
      }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.content) {
      console.error("ai-chat failed", data);
      return json({ error: "ai-chat failed", detail: data }, 502);
    }

    // Send via evolution-send
    const sendResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      },
      body: JSON.stringify({
        lead_id,
        text: data.content,
        client_message_id: crypto.randomUUID(),
      }),
    });
    const sendData = await sendResp.json();
    if (!sendResp.ok) {
      console.error("send failed", sendData);
      return json({ error: "send failed", detail: sendData }, 502);
    }

    return json({ ok: true, content: data.content, tools_used: data.tools_used });
  } catch (e) {
    console.error("ai-auto-reply", e);
    return json({ error: String(e) }, 500);
  }
});

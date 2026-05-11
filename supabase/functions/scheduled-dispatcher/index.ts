// Dispatches due scheduled_messages AND debounced auto-replies (pending_replies).
// Expected to be triggered by pg_cron every minute.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` };

async function processScheduled(supabase: any) {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("scheduled_messages").select("*")
    .eq("status", "pending").lte("send_at", nowIso)
    .order("send_at", { ascending: true }).limit(50);

  let sent = 0, failed = 0;
  for (const item of due ?? []) {
    try {
      const resp = await fetch(`${FUNCTIONS_URL}/evolution-send`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ lead_id: item.lead_id, text: item.content }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && !(data as any)?.error) {
        await supabase.from("scheduled_messages")
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", item.id);
        sent++;
      } else {
        await supabase.from("scheduled_messages")
          .update({ status: "failed", last_error: (data as any)?.error ?? `HTTP ${resp.status}` }).eq("id", item.id);
        failed++;
      }
    } catch (e) {
      await supabase.from("scheduled_messages")
        .update({ status: "failed", last_error: String(e) }).eq("id", item.id);
      failed++;
    }
  }
  return { processed: (due ?? []).length, sent, failed };
}

async function logErrorUsage(supabase: any, agentId: string, leadId: string, threadId: string | null, model: string | null, error: string, latencyMs: number) {
  try {
    await supabase.from("ai_usage").insert({
      agent_id: agentId, lead_id: leadId, thread_id: threadId,
      model: model ?? "unknown", status: "error", error: error.slice(0, 500),
      latency_ms: latencyMs, tools_called: 0, replied: false,
    });
  } catch (e) {
    console.error("logErrorUsage failed", e);
  }
}

async function handlePendingReply(supabase: any, item: any, nowIso: string): Promise<"replied" | "skipped" | "failed"> {
  // Atomically remove first (avoid double processing on overlap)
  const { data: claimed } = await supabase
    .from("pending_replies").delete()
    .eq("lead_id", item.lead_id).eq("agent_id", item.agent_id)
    .lte("run_at", nowIso).select("lead_id");
  if (!claimed || claimed.length === 0) {
    console.log(`[dispatcher] skip lead=${item.lead_id} agent=${item.agent_id} reason=already-claimed`);
    return "skipped";
  }

  const startedAt = Date.now();
  try {
    const { data: msgs } = await supabase.from("messages")
      .select("from_me, content, timestamp")
      .eq("lead_id", item.lead_id)
      .order("timestamp", { ascending: false }).limit(20);
    const ordered = (msgs ?? []).reverse();
    const conv = ordered.filter((m: any) => m.content)
      .map((m: any) => ({ role: m.from_me ? "assistant" : "user", content: m.content }));
    if (conv.length === 0) {
      console.log(`[dispatcher] skip lead=${item.lead_id} reason=empty-conv`);
      return "skipped";
    }

    const { data: agentRow } = await supabase
      .from("ai_agents").select("tools, silent, model").eq("id", item.agent_id).maybeSingle();
    const SILENT_TOOLS = new Set([
      "move_lead_stage","add_lead_note","set_lead_field","update_custom_field",
      "assign_attendant","remember_fact","transfer_to_human","create_task","schedule_message","get_lead_history",
      "add_lead_tag","remove_lead_tag","get_lead_state","search_knowledge_base",
    ]);
    const tools: string[] = (agentRow?.tools as string[]) ?? [];
    const silentByTools = tools.length > 0 && tools.every((t) => SILENT_TOOLS.has(t));
    const silent = !!agentRow?.silent || silentByTools;

    if (!silent) {
      if (conv[conv.length - 1].role !== "user") {
        console.log(`[dispatcher] skip lead=${item.lead_id} reason=last-not-user`);
        return "skipped";
      }
      const lastFromMe = ordered.filter((m: any) => m.from_me).slice(-1)[0];
      if (lastFromMe?.timestamp) {
        const ageMs = Date.now() - new Date(lastFromMe.timestamp).getTime();
        if (ageMs < 5 * 60 * 1000) {
          console.log(`[dispatcher] skip lead=${item.lead_id} reason=human-just-replied`);
          return "skipped";
        }
      }
    }

    let { data: thread } = await supabase.from("ai_threads").select("id")
      .eq("lead_id", item.lead_id).eq("agent_id", item.agent_id).maybeSingle();
    if (!thread) {
      const { data: t } = await supabase.from("ai_threads")
        .insert({ lead_id: item.lead_id, agent_id: item.agent_id, title: silent ? "Classificador" : "Auto-resposta" })
        .select("id").single();
      thread = t;
    }

    console.log(`[dispatcher] -> ai-chat lead=${item.lead_id} agent=${item.agent_id} silent=${silent} msgs=${conv.length}`);
    const aiResp = await fetch(`${FUNCTIONS_URL}/ai-chat`, {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({ agent_id: item.agent_id, lead_id: item.lead_id, thread_id: thread?.id, persist: true, messages: conv }),
    });
    const aiData = await aiResp.json().catch(() => ({}));
    const latency = Date.now() - startedAt;

    if (!aiResp.ok) {
      const errMsg = `ai-chat ${aiResp.status}: ${(aiData as any)?.error ?? "unknown"}`;
      console.error(`[dispatcher] FAIL lead=${item.lead_id} ${errMsg} latency=${latency}ms`);
      await logErrorUsage(supabase, item.agent_id, item.lead_id, thread?.id ?? null, agentRow?.model ?? null, errMsg, latency);
      return "failed";
    }

    const reply = ((aiData as any).content ?? "").trim();
    const toolsUsed = ((aiData as any).tools_used ?? []).length;
    console.log(`[dispatcher] OK lead=${item.lead_id} silent=${silent} tools=${toolsUsed} reply_len=${reply.length} latency=${latency}ms`);

    if (silent || !reply) return "replied";

    const sendResp = await fetch(`${FUNCTIONS_URL}/evolution-send`, {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({ lead_id: item.lead_id, text: reply, client_message_id: crypto.randomUUID() }),
    });
    if (sendResp.ok) return "replied";
    console.error(`[dispatcher] send failed lead=${item.lead_id} status=${sendResp.status}`);
    return "failed";
  } catch (e) {
    console.error(`[dispatcher] exception lead=${item.lead_id}`, e);
    await logErrorUsage(supabase, item.agent_id, item.lead_id, null, null, String(e), Date.now() - startedAt);
    return "failed";
  }
}

async function processPendingReplies(supabase: any) {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("pending_replies").select("*").lte("run_at", nowIso).limit(20);

  const items = due ?? [];
  if (items.length === 0) return { processed: 0, replied: 0, skipped: 0, failed: 0 };

  const results = await Promise.all(items.map((it: any) => handlePendingReply(supabase, it, nowIso)));
  let replied = 0, skipped = 0, failed = 0;
  for (const r of results) {
    if (r === "replied") replied++;
    else if (r === "skipped") skipped++;
    else failed++;
  }
  return { processed: items.length, replied, skipped, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();
  // Run both queues in parallel and let them finish even after the HTTP response returns
  // (cron tick can be very short — without waitUntil the runtime may abort in-flight fetches).
  const work = (async () => {
    const sched = await processScheduled(supabase);
    const replies = await processPendingReplies(supabase);
    console.log(`[dispatcher] tick done scheduled=${JSON.stringify(sched)} replies=${JSON.stringify(replies)}`);
  })();
  // @ts-ignore EdgeRuntime is available in Supabase edge runtime
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;
  return json({ ok: true, queued: true });
});

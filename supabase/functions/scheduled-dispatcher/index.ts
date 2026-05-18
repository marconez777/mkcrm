// Dispatches due scheduled_messages AND debounced auto-replies (pending_replies).
// Expected to be triggered by pg_cron every minute.
//
// Loss-protection (P0 fix): pending_replies items are CLAIMED with status='processing'
// (not deleted) before invoking ai-chat/evolution-send. On success the row is removed;
// on failure the row is unclaimed with status='pending' + exponential backoff so the
// next tick retries it (up to MAX_ATTEMPTS).
import { corsHeaders, json, sb } from "../_shared/evolution.ts";
import { pmap } from "../_shared/utils.ts";
import { isSilentByTools } from "../_shared/agent-flags.ts";

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` };

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 30_000, 120_000]; // 0s, 30s, 2min
const STALE_CLAIM_MS = 5 * 60 * 1000;    // recover stuck claims after 5min

async function processScheduled(supabase: any) {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("scheduled_messages").select("*")
    .eq("status", "pending").lte("send_at", nowIso)
    .order("send_at", { ascending: true }).limit(50);

  const items = due ?? [];
  if (items.length === 0) return { processed: 0, sent: 0, failed: 0 };

  const results = await pmap(items, 10, async (item: any) => {
    try {
      const resp = await fetch(`${FUNCTIONS_URL}/evolution-send`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ lead_id: item.lead_id, text: item.content }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && !(data as any)?.error) {
        await supabase.from("scheduled_messages")
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", item.id);
        return "sent" as const;
      }
      await supabase.from("scheduled_messages")
        .update({ status: "failed", last_error: (data as any)?.error ?? `HTTP ${resp.status}` }).eq("id", item.id);
      return "failed" as const;
    } catch (e) {
      await supabase.from("scheduled_messages")
        .update({ status: "failed", last_error: String(e) }).eq("id", item.id);
      return "failed" as const;
    }
  });

  let sent = 0, failed = 0;
  for (const r of results) { if (r === "sent") sent++; else failed++; }
  return { processed: items.length, sent, failed };
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

/** Atomically transition pending → processing. Returns the claimed row or null. */
async function claimReply(supabase: any, item: any, nowIso: string) {
  const { data } = await supabase
    .from("pending_replies")
    .update({ status: "processing", claimed_at: nowIso, attempts: (item.attempts ?? 0) + 1 })
    .eq("lead_id", item.lead_id)
    .eq("agent_id", item.agent_id)
    .eq("status", "pending")
    .lte("run_at", nowIso)
    .select("lead_id, attempts")
    .maybeSingle();
  return data;
}

/** Release a failed claim back to pending with exponential backoff, or give up. */
async function releaseOrAbandon(supabase: any, leadId: string, agentId: string, attempts: number, errMsg: string) {
  if (attempts >= MAX_ATTEMPTS) {
    await supabase.from("pending_replies").delete().eq("lead_id", leadId).eq("agent_id", agentId);
    console.error(`[dispatcher] abandoned after ${attempts} attempts lead=${leadId} agent=${agentId} err=${errMsg}`);
    return;
  }
  const backoff = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
  const nextRun = new Date(Date.now() + backoff).toISOString();
  await supabase.from("pending_replies").update({
    status: "pending",
    run_at: nextRun,
    last_error: errMsg.slice(0, 500),
    claimed_at: null,
  }).eq("lead_id", leadId).eq("agent_id", agentId);
}

async function handlePendingReply(supabase: any, item: any, nowIso: string): Promise<"replied" | "skipped" | "failed"> {
  const claimed = await claimReply(supabase, item, nowIso);
  if (!claimed) {
    console.log(`[dispatcher] skip lead=${item.lead_id} agent=${item.agent_id} reason=already-claimed-or-stale`);
    return "skipped";
  }
  const attempts = claimed.attempts ?? 1;
  const startedAt = Date.now();

  try {
    const { data: msgs } = await supabase.from("messages")
      .select("from_me, content, timestamp, bot_agent_id")
      .eq("lead_id", item.lead_id)
      .order("timestamp", { ascending: false }).limit(20);
    const ordered = (msgs ?? []).reverse();
    const conv = ordered.filter((m: any) => m.content)
      .map((m: any) => ({ role: m.from_me ? "assistant" : "user", content: m.content }));
    if (conv.length === 0) {
      await supabase.from("pending_replies").delete().eq("lead_id", item.lead_id).eq("agent_id", item.agent_id);
      console.log(`[dispatcher] skip lead=${item.lead_id} reason=empty-conv`);
      return "skipped";
    }

    const { data: agentRow } = await supabase
      .from("ai_agents").select("tools, silent, model").eq("id", item.agent_id).maybeSingle();
    const tools: string[] = (agentRow?.tools as string[]) ?? [];
    const silent = !!agentRow?.silent || isSilentByTools(tools);

    if (!silent) {
      if (conv[conv.length - 1].role !== "user") {
        await supabase.from("pending_replies").delete().eq("lead_id", item.lead_id).eq("agent_id", item.agent_id);
        console.log(`[dispatcher] skip lead=${item.lead_id} reason=last-not-user`);
        return "skipped";
      }
      // If the most recent human (non-bot) reply is recent, defer to human.
      const lastFromMeHuman = ordered.filter((m: any) => m.from_me && !m.bot_agent_id).slice(-1)[0];
      if (lastFromMeHuman?.timestamp) {
        const ageMs = Date.now() - new Date(lastFromMeHuman.timestamp).getTime();
        if (ageMs < 5 * 60 * 1000) {
          await supabase.from("pending_replies").delete().eq("lead_id", item.lead_id).eq("agent_id", item.agent_id);
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

    console.log(`[dispatcher] -> ai-chat lead=${item.lead_id} agent=${item.agent_id} silent=${silent} msgs=${conv.length} attempt=${attempts}`);
    const aiResp = await fetch(`${FUNCTIONS_URL}/ai-chat`, {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({ agent_id: item.agent_id, lead_id: item.lead_id, thread_id: thread?.id, persist: true, messages: conv }),
    });
    const aiData = await aiResp.json().catch(() => ({}));
    const latency = Date.now() - startedAt;

    if (!aiResp.ok) {
      const errMsg = `ai-chat ${aiResp.status}: ${(aiData as any)?.error ?? "unknown"}`;
      console.error(`[dispatcher] FAIL lead=${item.lead_id} ${errMsg} latency=${latency}ms attempt=${attempts}`);
      await logErrorUsage(supabase, item.agent_id, item.lead_id, thread?.id ?? null, agentRow?.model ?? null, errMsg, latency);
      await releaseOrAbandon(supabase, item.lead_id, item.agent_id, attempts, errMsg);
      return "failed";
    }

    const reply = ((aiData as any).content ?? "").trim();
    const toolsUsed = ((aiData as any).tools_used ?? []).length;
    console.log(`[dispatcher] ai-chat OK lead=${item.lead_id} silent=${silent} tools=${toolsUsed} reply_len=${reply.length} latency=${latency}ms`);

    if (silent || !reply) {
      // Success path for silent agents (no message to send) — drop the claim.
      await supabase.from("pending_replies").delete().eq("lead_id", item.lead_id).eq("agent_id", item.agent_id);
      return "replied";
    }

    // Non-silent: send the reply. Only drop the claim AFTER the send succeeds.
    const sendResp = await fetch(`${FUNCTIONS_URL}/evolution-send`, {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({
        lead_id: item.lead_id,
        text: reply,
        client_message_id: crypto.randomUUID(),
        bot_agent_id: item.agent_id, // marks the message so auto-reply doesn't loop
      }),
    });
    if (sendResp.ok) {
      await supabase.from("pending_replies").delete().eq("lead_id", item.lead_id).eq("agent_id", item.agent_id);
      return "replied";
    }
    const sendErr = `send ${sendResp.status}`;
    console.error(`[dispatcher] send failed lead=${item.lead_id} ${sendErr}`);
    await releaseOrAbandon(supabase, item.lead_id, item.agent_id, attempts, sendErr);
    return "failed";
  } catch (e) {
    console.error(`[dispatcher] exception lead=${item.lead_id}`, e);
    await logErrorUsage(supabase, item.agent_id, item.lead_id, null, null, String(e), Date.now() - startedAt);
    await releaseOrAbandon(supabase, item.lead_id, item.agent_id, attempts, String(e));
    return "failed";
  }
}

/** Recover items stuck in "processing" longer than STALE_CLAIM_MS (e.g. edge restart). */
async function recoverStaleClaims(supabase: any) {
  const cutoff = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  await supabase
    .from("pending_replies")
    .update({ status: "pending", claimed_at: null })
    .eq("status", "processing")
    .lt("claimed_at", cutoff);
}

async function processPendingReplies(supabase: any) {
  await recoverStaleClaims(supabase);
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("pending_replies").select("*")
    .eq("status", "pending")
    .lte("run_at", nowIso)
    .limit(20);

  const items = due ?? [];
  if (items.length === 0) return { processed: 0, replied: 0, skipped: 0, failed: 0 };

  const results = await pmap(items, 5, (it: any) => handlePendingReply(supabase, it, nowIso));
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

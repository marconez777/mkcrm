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

async function processPendingReplies(supabase: any) {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("pending_replies").select("*").lte("run_at", nowIso).limit(20);

  let replied = 0, skipped = 0, failed = 0;
  for (const item of due ?? []) {
    // Atomically remove first (avoid double processing on overlap)
    const { data: claimed } = await supabase
      .from("pending_replies").delete().eq("lead_id", item.lead_id).lte("run_at", nowIso).select("lead_id");
    if (!claimed || claimed.length === 0) { skipped++; continue; }

    try {
      // Build last 20 messages
      const { data: msgs } = await supabase.from("messages")
        .select("from_me, content, timestamp")
        .eq("lead_id", item.lead_id)
        .order("timestamp", { ascending: false }).limit(20);
      const ordered = (msgs ?? []).reverse();
      const conv = ordered.filter((m: any) => m.content)
        .map((m: any) => ({ role: m.from_me ? "assistant" : "user", content: m.content }));
      if (conv.length === 0) { skipped++; continue; }

      // Load agent to know if it's "silent" (classifier-style: tools-only, no text reply).
      const { data: agentRow } = await supabase
        .from("ai_agents").select("tools, silent").eq("id", item.agent_id).maybeSingle();
      const SILENT_TOOLS = new Set([
        "move_lead_stage","add_lead_note","set_lead_field","update_custom_field",
        "assign_attendant","remember_fact","transfer_to_human","create_task","schedule_message","get_lead_history",
        "add_lead_tag","remove_lead_tag","get_lead_state","search_knowledge_base",
      ]);
      const tools: string[] = (agentRow?.tools as string[]) ?? [];
      const silentByTools = tools.length > 0 && tools.every((t) => SILENT_TOOLS.has(t));
      const silent = !!agentRow?.silent || silentByTools;

      // Non-silent agents only respond to a user as the most recent turn,
      // and must not step on a human atendente that just answered.
      if (!silent) {
        if (conv[conv.length - 1].role !== "user") { skipped++; continue; }
        const lastFromMe = ordered.filter((m: any) => m.from_me).slice(-1)[0];
        if (lastFromMe?.timestamp) {
          const ageMs = Date.now() - new Date(lastFromMe.timestamp).getTime();
          if (ageMs < 5 * 60 * 1000) { skipped++; continue; }
        }
      }

      // Find or create thread
      let { data: thread } = await supabase.from("ai_threads").select("id")
        .eq("lead_id", item.lead_id).eq("agent_id", item.agent_id).maybeSingle();
      if (!thread) {
        const { data: t } = await supabase.from("ai_threads")
          .insert({ lead_id: item.lead_id, agent_id: item.agent_id, title: "Auto-resposta" })
          .select("id").single();
        thread = t;
      }

      const aiResp = await fetch(`${FUNCTIONS_URL}/ai-chat`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ agent_id: item.agent_id, lead_id: item.lead_id, thread_id: thread?.id, persist: true, messages: conv }),
      });
      const aiData = await aiResp.json();
      if (!aiResp.ok) { failed++; continue; }
      const reply = (aiData.content ?? "").trim();
      // Agentes "silenciosos" (ex.: classificador) só usam tools e não respondem texto
      if (!reply) { replied++; continue; }

      const sendResp = await fetch(`${FUNCTIONS_URL}/evolution-send`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ lead_id: item.lead_id, text: reply, client_message_id: crypto.randomUUID() }),
      });
      if (sendResp.ok) replied++; else failed++;
    } catch (e) {
      console.error("pending reply error", e);
      failed++;
    }
  }
  return { processed: (due ?? []).length, replied, skipped, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();
  const sched = await processScheduled(supabase);
  const replies = await processPendingReplies(supabase);
  return json({ ok: true, scheduled: sched, replies });
});

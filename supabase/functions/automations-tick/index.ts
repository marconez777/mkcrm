// Periodic tick: evaluates enabled automations and fires actions per matching lead.
// Triggered by pg_cron every 5 minutes.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

type Automation = {
  id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: any;
  action_type: string;
  action_config: any;
  cooldown_hours: number;
};

async function recentlyRan(supabase: any, automationId: string, leadId: string, cooldownHours: number) {
  const since = new Date(Date.now() - cooldownHours * 3600_000).toISOString();
  const { data } = await supabase
    .from("automation_runs")
    .select("id")
    .eq("automation_id", automationId)
    .eq("lead_id", leadId)
    .eq("status", "success")
    .gte("created_at", since)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function logRun(supabase: any, automationId: string, leadId: string, status: string, detail?: string) {
  await supabase.from("automation_runs").insert({
    automation_id: automationId,
    lead_id: leadId,
    status,
    detail: detail?.slice(0, 500),
  });
}

async function findCandidates(supabase: any, a: Automation): Promise<any[]> {
  if (a.trigger_type === "no_reply_after") {
    const hours = Number(a.trigger_config?.hours ?? 24);
    const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
    let q = supabase
      .from("leads")
      .select("id, stage_id, last_message_at")
      .lte("last_message_at", cutoff)
      .is("archived_at", null)
      .limit(50);
    if (a.trigger_config?.stage_id) q = q.eq("stage_id", a.trigger_config.stage_id);
    const { data } = await q;
    // Filter: last message must be inbound (from_me = false)
    const out: any[] = [];
    for (const l of data ?? []) {
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("from_me")
        .eq("lead_id", l.id)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMsg && lastMsg.from_me === false) out.push(l);
    }
    return out;
  }
  if (a.trigger_type === "stage_idle") {
    const hours = Number(a.trigger_config?.hours ?? 48);
    const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
    const { data } = await supabase
      .from("leads")
      .select("id, stage_id, stage_changed_at")
      .eq("stage_id", a.trigger_config?.stage_id)
      .lte("stage_changed_at", cutoff)
      .is("archived_at", null)
      .limit(50);
    return data ?? [];
  }
  return [];
}

async function runAction(supabase: any, a: Automation, leadId: string): Promise<{ ok: boolean; detail?: string }> {
  if (a.action_type === "ai_followup") {
    const agentId = a.action_config?.agent_id;
    if (!agentId) return { ok: false, detail: "missing agent_id" };
    const prompt = a.action_config?.prompt
      ?? "Envie um follow-up educado e curto retomando a conversa, sem ser invasivo.";

    // Fetch last messages
    const { data: msgs } = await supabase
      .from("messages")
      .select("from_me, content")
      .eq("lead_id", leadId)
      .order("timestamp", { ascending: false })
      .limit(20);
    const conv = (msgs ?? []).reverse().filter((m: any) => m.content).map((m: any) => ({
      role: m.from_me ? "assistant" : "user",
      content: m.content,
    }));
    conv.push({ role: "user", content: `[INSTRUÇÃO INTERNA — não repita ao cliente]: ${prompt}` });

    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      },
      body: JSON.stringify({ agent_id: agentId, lead_id: leadId, persist: true, messages: conv }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.content) return { ok: false, detail: `ai-chat ${resp.status}` };

    const sendResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      },
      body: JSON.stringify({ lead_id: leadId, text: data.content, client_message_id: crypto.randomUUID() }),
    });
    if (!sendResp.ok) return { ok: false, detail: `send ${sendResp.status}` };
    return { ok: true, detail: data.content.slice(0, 200) };
  }

  if (a.action_type === "move_stage") {
    const stageId = a.action_config?.stage_id;
    if (!stageId) return { ok: false, detail: "missing stage_id" };
    const { error } = await supabase.from("leads").update({ stage_id: stageId }).eq("id", leadId);
    if (error) return { ok: false, detail: error.message };
    return { ok: true };
  }

  if (a.action_type === "send_template") {
    const templateId = a.action_config?.template_id;
    if (!templateId) return { ok: false, detail: "missing template_id" };
    const { data: tpl } = await supabase
      .from("message_templates")
      .select("content")
      .eq("id", templateId)
      .maybeSingle();
    if (!tpl) return { ok: false, detail: "template not found" };

    const { data: lead } = await supabase
      .from("leads")
      .select("name, phone, email, company")
      .eq("id", leadId)
      .single();
    const name = lead?.name || lead?.phone || "";
    const first = name.split(" ")[0] || "";
    const text = (tpl.content as string)
      .split("{{nome}}").join(name)
      .split("{{primeiro_nome}}").join(first)
      .split("{{telefone}}").join(lead?.phone ?? "")
      .split("{{email}}").join(lead?.email ?? "")
      .split("{{empresa}}").join(lead?.company ?? "");

    const sendResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      },
      body: JSON.stringify({ lead_id: leadId, text, client_message_id: crypto.randomUUID() }),
    });
    if (!sendResp.ok) return { ok: false, detail: `send ${sendResp.status}` };
    return { ok: true, detail: text.slice(0, 200) };
  }

  return { ok: false, detail: `unknown action ${a.action_type}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const { data: automations } = await supabase
      .from("automations")
      .select("*")
      .eq("enabled", true);

    const summary: any[] = [];
    for (const a of (automations ?? []) as Automation[]) {
      const candidates = await findCandidates(supabase, a);
      let fired = 0, skipped = 0, failed = 0;
      for (const lead of candidates) {
        if (await recentlyRan(supabase, a.id, lead.id, a.cooldown_hours)) {
          skipped++;
          continue;
        }
        const res = await runAction(supabase, a, lead.id);
        await logRun(supabase, a.id, lead.id, res.ok ? "success" : "error", res.detail);
        if (res.ok) fired++; else failed++;
      }
      summary.push({ automation: a.name, candidates: candidates.length, fired, skipped, failed });
    }
    return json({ ok: true, summary });
  } catch (e) {
    console.error("automations-tick", e);
    return json({ error: String(e) }, 500);
  }
});

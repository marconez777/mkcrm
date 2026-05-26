// Periodic tick: evaluates enabled automations and fires actions per matching lead.
// Triggered by pg_cron every 5 minutes.
import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";
import { renderTemplate } from "../_shared/template-vars.ts";

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
  if (a.trigger_type === "before_appointment") {
    const cfg = a.trigger_config ?? {};
    const fieldKey: string = cfg.field_key;
    const offsetMin = Number(cfg.offset_minutes ?? 60);
    const tz: string = cfg.tz || "America/Sao_Paulo";
    const preferred: string | undefined = cfg.preferred_time; // "HH:MM"
    const businessOnly: boolean = !!cfg.business_hours_only;
    if (!fieldKey) return [];

    const now = new Date();
    // Janela ampla — refinamos no filtro
    const winStart = new Date(now.getTime() - 5 * 60_000);
    const winEnd = new Date(now.getTime() + offsetMin * 60_000 + 24 * 3600_000);

    let q = supabase
      .from("leads")
      .select("id, stage_id, custom_fields")
      .not("custom_fields->>" + fieldKey, "is", null)
      .is("archived_at", null)
      .limit(200);
    if (cfg.stage_id) q = q.eq("stage_id", cfg.stage_id);
    const { data } = await q;

    // Hora local atual no tz
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    const localHM = `${get("hour")}:${get("minute")}`;
    const localWeekday = get("weekday"); // Mon, Tue...
    const isWeekday = !["Sat", "Sun"].includes(localWeekday);
    const localHour = Number(get("hour"));

    if (businessOnly && (!isWeekday || localHour < 8 || localHour >= 18)) return [];
    if (preferred && localHM < preferred) return [];

    const out: any[] = [];
    for (const l of data ?? []) {
      const raw = (l.custom_fields as any)?.[fieldKey];
      if (!raw) continue;
      const appt = new Date(raw);
      if (isNaN(appt.getTime())) continue;
      const target = new Date(appt.getTime() - offsetMin * 60_000);
      // Dispara se passamos o alvo mas ainda faltam >=5min para a consulta
      if (now >= target && now <= new Date(appt.getTime() - 5 * 60_000)) {
        out.push(l);
      }
      // Para o caso D-1 com preferred_time: garante que estamos no mesmo dia local do target
      if (preferred) {
        const targetParts = new Intl.DateTimeFormat("en-GB", {
          timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        }).formatToParts(target);
        const nowDay = `${get("year")}-${get("month")}-${get("day")}`;
        const tgtDay = `${targetParts.find(p=>p.type==="year")?.value}-${targetParts.find(p=>p.type==="month")?.value}-${targetParts.find(p=>p.type==="day")?.value}`;
        if (nowDay !== tgtDay) {
          // remove se acabamos de adicionar
          if (out[out.length - 1]?.id === l.id) out.pop();
        }
      }
    }
    return out;
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
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
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

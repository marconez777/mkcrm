// Periodic tick: evaluates enabled automations and fires actions per matching lead.
// Triggered by pg_cron every 5 minutes.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";
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

// Para trigger before_appointment: bloqueia reenvio apenas se o último run
// de sucesso foi para a MESMA data de consulta. Se a data mudou (reagendamento),
// permite disparar de novo.
async function shouldSkipForAppointment(
  supabase: any,
  automationId: string,
  leadId: string,
  cooldownHours: number,
  currentApptISO: string,
) {
  const since = new Date(Date.now() - cooldownHours * 3600_000).toISOString();
  const { data } = await supabase
    .from("automation_runs")
    .select("appointment_at")
    .eq("automation_id", automationId)
    .eq("lead_id", leadId)
    .eq("status", "success")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = data?.[0];
  if (!last) return false;
  // Run antigo sem appointment_at: aplica cooldown clássico (não reenvia) para
  // evitar broadcast retroativo.
  if (!last.appointment_at) return true;
  const lastTs = new Date(last.appointment_at).getTime();
  const curTs = new Date(currentApptISO).getTime();
  // Mesma data → ainda em cooldown. Data diferente → reagendou, libera.
  return lastTs === curTs;
}

async function logRun(
  supabase: any,
  automationId: string,
  leadId: string,
  clinicId: string,
  status: string,
  detail?: string,
  appointmentAt?: string | null,
) {
  const { error } = await supabase.from("automation_runs").insert({
    automation_id: automationId,
    lead_id: leadId,
    clinic_id: clinicId,
    status,
    detail: detail?.slice(0, 500),
    appointment_at: appointmentAt ?? null,
  });
  if (error) console.error("[automations-tick] logRun failed", { automationId, leadId, error: error.message });
}

async function findCandidates(supabase: any, a: Automation): Promise<any[]> {
  // Aceita stage_ids (array) ou stage_id (single, legado). stage_ids tem prioridade.
  const cfgStageIds: string[] | undefined = Array.isArray(a.trigger_config?.stage_ids) && a.trigger_config.stage_ids.length > 0
    ? a.trigger_config.stage_ids
    : (a.trigger_config?.stage_id ? [a.trigger_config.stage_id] : undefined);

  if (a.trigger_type === "no_reply_after") {
    const hours = Number(a.trigger_config?.hours ?? 24);
    const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
    let q = supabase
      .from("leads")
      .select("id, stage_id, last_message_at")
      .lte("last_message_at", cutoff)
      .is("archived_at", null)
      .limit(50);
    if (cfgStageIds) q = q.in("stage_id", cfgStageIds);
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
    let q = supabase
      .from("leads")
      .select("id, stage_id, stage_changed_at")
      .lte("stage_changed_at", cutoff)
      .is("archived_at", null)
      .limit(50);
    if (cfgStageIds) q = q.in("stage_id", cfgStageIds);
    const { data } = await q;
    return data ?? [];
  }

  if (a.trigger_type === "before_appointment") {
    const cfg = a.trigger_config ?? {};
    const fieldKey: string = cfg.field_key;
    const offsetMin = Number(cfg.offset_minutes ?? 60);
    const tz: string = cfg.tz || "America/Sao_Paulo";
    const preferred: string | undefined = cfg.preferred_time; // "HH:MM"
    const businessOnly: boolean = !!cfg.business_hours_only;
    const businessStart = Number(cfg.business_hours_start ?? 10);
    const businessEnd = Number(cfg.business_hours_end ?? 22);
    if (!fieldKey) return [];

    const now = new Date();
    // Janela ampla — refinamos no filtro
    const winStart = new Date(now.getTime() - 5 * 60_000);
    const winEnd = new Date(now.getTime() + offsetMin * 60_000 + 24 * 3600_000);

    let q = supabase
      .from("leads")
      .select("id, stage_id, custom_fields, updated_at")
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

    if (businessOnly && (!isWeekday || localHour < businessStart || localHour >= businessEnd)) return [];
    if (preferred && localHM < preferred) return [];

    // Helper: YYYY-MM-DD no tz
    const ymdInTZ = (d: Date) => {
      const ps = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(d);
      const g = (t: string) => ps.find((p) => p.type === t)?.value || "";
      return `${g("year")}-${g("month")}-${g("day")}`;
    };
    const nowDay = `${get("year")}-${get("month")}-${get("day")}`;

    const out: any[] = [];
    for (const l of data ?? []) {
      const raw = (l.custom_fields as any)?.[fieldKey];
      if (!raw) continue;
      const appt = new Date(raw);
      if (isNaN(appt.getTime())) continue;
      const target = new Date(appt.getTime() - offsetMin * 60_000);
      // Dispara se passamos o alvo mas ainda faltam >=5min para a consulta
      if (!(now >= target && now <= new Date(appt.getTime() - 5 * 60_000))) continue;

      // Para o caso D-1 com preferred_time: garante que estamos no mesmo dia local do target
      if (preferred && ymdInTZ(target) !== nowDay) continue;

      // Bloqueio "agendado no mesmo dia da consulta" — evita confirmação fora de hora
      // quando o atendente marca de última hora. Permite só o lembrete curto se ainda
      // houver folga > 5h até a consulta.
      const apptDay = ymdInTZ(appt);
      const bookedAt = l.updated_at ? new Date(l.updated_at) : null;
      const bookedDay = bookedAt ? ymdInTZ(bookedAt) : null;
      if (bookedDay && bookedDay === apptDay) {
        const hoursToAppt = (appt.getTime() - now.getTime()) / 3600_000;
        // Offsets longos (>=6h, ex.: D-1=1440min) nunca disparam para agendamento no mesmo dia
        if (offsetMin >= 360) {
          await logRun(supabase, a.id, l.id, a.clinic_id, "skipped", "same_day_short_notice", appt.toISOString());
          continue;
        }
        if (hoursToAppt <= 5) {
          await logRun(supabase, a.id, l.id, a.clinic_id, "skipped", "same_day_short_notice", appt.toISOString());
          continue;
        }
      }

      out.push({ ...l, appointment_at: appt.toISOString() });
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
    if (!resp.ok || !data.content) {
      const body = JSON.stringify(data).slice(0, 240);
      return { ok: false, detail: `ai-chat ${resp.status}: ${body}` };
    }

    const sendResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      },
      body: JSON.stringify({ lead_id: leadId, text: data.content, client_message_id: crypto.randomUUID() }),
    });
    if (!sendResp.ok) {
      const body = (await sendResp.text().catch(() => "")).slice(0, 240);
      return { ok: false, detail: `send ${sendResp.status}: ${body}` };
    }
    return { ok: true, detail: data.content.slice(0, 200) };
  }

  if (a.action_type === "move_stage") {
    const stageId = a.action_config?.stage_id;
    if (!stageId) return { ok: false, detail: "missing stage_id" };

    // Verifica trava de etapa (lock_auto_move) tanto na origem quanto no destino
    const { data: targetStage } = await supabase
      .from("pipeline_stages")
      .select("lock_auto_move")
      .eq("id", stageId)
      .maybeSingle();
    if (targetStage?.lock_auto_move) {
      return { ok: false, detail: "stage_locked:target" };
    }
    const { data: leadRow } = await supabase
      .from("leads").select("stage_id").eq("id", leadId).maybeSingle();
    if (leadRow?.stage_id) {
      const { data: curStage } = await supabase
        .from("pipeline_stages")
        .select("lock_auto_move")
        .eq("id", leadRow.stage_id)
        .maybeSingle();
      if (curStage?.lock_auto_move) {
        return { ok: false, detail: "stage_locked:source" };
      }
    }

    const fromStage = leadRow?.stage_id ?? null;
    const { error } = await supabase.from("leads").update({ stage_id: stageId }).eq("id", leadId);
    if (error) return { ok: false, detail: error.message };

    // Onda 7 / Fase 1: enriquecer histórico (sem inserir 2ª linha — trigger já criou).
    const { data: latest } = await supabase
      .from("lead_stage_history")
      .select("id")
      .eq("lead_id", leadId)
      .order("moved_at", { ascending: false })
      .limit(1);
    const rowId = (latest?.[0] as { id?: string } | undefined)?.id;
    if (rowId) {
      await supabase.from("lead_stage_history").update({
        reason: `automation:${a.id}`,
        source: "automations_tick",
        metadata: {
          automation_id: a.id,
          from_stage_id: fromStage,
          to_stage_id: stageId,
          at: new Date().toISOString(),
        },
      }).eq("id", rowId);
    }
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

    const [{ data: lead }, { data: defs }] = await Promise.all([
      supabase
        .from("leads")
        .select("name, phone, email, company, custom_fields")
        .eq("id", leadId)
        .single(),
      supabase.from("lead_custom_fields").select("field_key, field_type"),
    ]);
    const text = renderTemplate(tpl.content as string, lead ?? {}, (defs ?? []) as any);

    const sendResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      },
      body: JSON.stringify({ lead_id: leadId, text, client_message_id: crypto.randomUUID() }),
    });
    if (!sendResp.ok) {
      const body = (await sendResp.text().catch(() => "")).slice(0, 240);
      return { ok: false, detail: `send ${sendResp.status}: ${body}` };
    }
    return { ok: true, detail: text.slice(0, 200) };
  }

  return { ok: false, detail: `unknown action ${a.action_type}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // Tick público — chamado por pg_cron (sem Authorization Bearer). verify_jwt=false em config.toml.
  const supabase = sb();

  try {
    const { getPausedClinicIds } = await import("../_shared/automations-paused.ts");
    const paused = await getPausedClinicIds(supabase);
    const { data: automationsAll } = await supabase
      .from("automations")
      .select("*")
      .eq("enabled", true);
    const automations = (automationsAll ?? []).filter((a: any) => !paused.has(a.clinic_id));

    const summary: any[] = [];
    for (const a of (automations ?? []) as Automation[]) {
      const candidates = await findCandidates(supabase, a);
      let fired = 0, skipped = 0, failed = 0;
      // Piso defensivo de cooldown para before_appointment: evita reenvio a cada
      // tick quando cooldown_hours=0. Mínimo = ceil(offset_h * 1.5).
      const isAppt = a.trigger_type === "before_appointment";
      const offsetMin = Number(a.trigger_config?.offset_minutes ?? 60);
      const effectiveCooldownH = isAppt
        ? Math.max(a.cooldown_hours ?? 0, Math.ceil((offsetMin / 60) * 1.5), 1)
        : Math.max(a.cooldown_hours ?? 0, 1);
      for (const lead of candidates) {
        const apptISO: string | null = lead.appointment_at ?? null;
        const skip = isAppt && apptISO
          ? await shouldSkipForAppointment(supabase, a.id, lead.id, effectiveCooldownH, apptISO)
          : await recentlyRan(supabase, a.id, lead.id, effectiveCooldownH);
        if (skip) {
          skipped++;
          continue;
        }
        const res = await runAction(supabase, a, lead.id);
        await logRun(supabase, a.id, lead.id, a.clinic_id, res.ok ? "success" : "error", res.detail, apptISO);
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

// Runs once a minute (pg_cron). For each enabled scheduled_report, if the
// current local time matches the configured send_time/weekdays and we have
// not already sent today, build the metrics text and send it to the group.
import { corsHeaders, json, sb, loadInstance, evoFetch } from "../_shared/evolution.ts";

type Report = {
  id: string;
  clinic_id: string;
  name: string;
  instance_id: string;
  group_jid: string;
  group_name: string | null;
  send_time: string; // "HH:MM"
  tz: string;
  weekdays: number[]; // 0=Sun..6=Sat
  metrics: Record<string, boolean>;
  enabled: boolean;
  last_sent_at: string | null;
};

function localParts(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => f.find((p) => p.type === t)?.value || "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hhmm: `${get("hour")}:${get("minute")}`,
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: weekdayMap[get("weekday")] ?? -1,
    dmy: `${get("day")}/${get("month")}/${get("year")}`,
  };
}

/** Compute the UTC instant for local midnight (today) in the given tz. */
function startOfLocalDayUtc(now: Date, tz: string): Date {
  const lp = localParts(now, tz);
  const [y, m, d] = lp.ymd.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const back = localParts(guess, tz);
  const [bh, bm] = back.hhmm.split(":").map(Number);
  const driftMin = bh * 60 + bm;
  return new Date(guess.getTime() - driftMin * 60_000);
}

/** End of local day = start of next local day. */
function endOfLocalDayUtc(now: Date, tz: string): Date {
  const start = startOfLocalDayUtc(now, tz);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

async function computeMetrics(
  supabase: any,
  clinicId: string,
  sinceIso: string,
  untilIso: string,
  want: Record<string, boolean>,
) {
  const out: Record<string, number> = {};

  // 1) Visitantes únicos — mesma fonte do card em /tracking
  if (want.unique_visitors !== false) {
    const { count } = await supabase
      .from("tracking_visitors")
      .select("visitor_id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("last_seen_at", sinceIso)
      .lt("last_seen_at", untilIso);
    out.unique_visitors = count ?? 0;
  }

  // 2) Cliques no WhatsApp — conta eventos (whatsapp_click + whatsapp_redirect)
  if (want.whatsapp_clicks !== false) {
    const { count } = await supabase
      .from("tracking_events")
      .select("event_id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("event_time", sinceIso)
      .lt("event_time", untilIso)
      .in("event_name", ["whatsapp_click", "whatsapp_redirect"]);
    out.whatsapp_clicks = count ?? 0;
  }

  // 3/4) Leads identificados via tracking — separa formulário x WhatsApp pelo link_source.
  if (want.form_leads !== false || want.whatsapp_leads !== false) {
    const { data: links } = await supabase
      .from("tracking_identity_links")
      .select("lead_id, link_source, leads!inner(clinic_id)")
      .eq("leads.clinic_id", clinicId)
      .gte("linked_at", sinceIso)
      .lt("linked_at", untilIso)
      .limit(5000);

    const formLeads = new Set<string>();
    const waLeads = new Set<string>();
    for (const l of (links ?? []) as Array<{ lead_id: string; link_source: string | null }>) {
      const src = String(l.link_source || "").toLowerCase();
      const isWa = src.startsWith("whatsapp_") || src === "ctwa_clid" || src === "phone_hash_existing";
      if (isWa) waLeads.add(l.lead_id);
      else if (src === "form_submission") formLeads.add(l.lead_id);
    }
    if (want.form_leads !== false) out.form_leads = formLeads.size;
    if (want.whatsapp_leads !== false) out.whatsapp_leads = waLeads.size;
  }

  console.log("[scheduled-report-tick] metrics", { clinicId, sinceIso, untilIso, ...out });
  return out;
}

function buildMessage(reportName: string, dmy: string, m: Record<string, number>, want: Record<string, boolean>) {
  const lines: string[] = [`📊 ${reportName} — ${dmy}`];
  if (want.unique_visitors !== false) lines.push(`👀 Visitantes únicos: ${m.unique_visitors ?? 0}`);
  if (want.whatsapp_clicks !== false) lines.push(`💬 Cliques no WhatsApp: ${m.whatsapp_clicks ?? 0}`);
  if (want.form_leads !== false) lines.push(`📝 Leads (formulário): ${m.form_leads ?? 0}`);
  if (want.whatsapp_leads !== false) lines.push(`📱 Leads (WhatsApp): ${m.whatsapp_leads ?? 0}`);
  return lines.join("\n");
}

async function sendToGroup(instance: any, groupJid: string, text: string) {
  const res = await evoFetch(
    instance,
    `/message/sendText/${encodeURIComponent(instance.evolution_instance)}`,
    { method: "POST", body: JSON.stringify({ number: groupJid, text }) },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`evolution ${res.status}: ${body.slice(0, 200)}`);
  return body;
}

async function processReport(supabase: any, r: Report, opts: { force?: boolean } = {}) {
  const now = new Date();
  const lp = localParts(now, r.tz);

  if (!opts.force) {
    if (!r.weekdays.includes(lp.weekday)) return { skipped: "weekday" };
    if (lp.hhmm !== r.send_time) return { skipped: "time" };
    if (r.last_sent_at) {
      const lastLocal = localParts(new Date(r.last_sent_at), r.tz).ymd;
      if (lastLocal === lp.ymd) return { skipped: "already_sent_today" };
    }
  }

  const sinceIso = startOfLocalDayUtc(now, r.tz).toISOString();
  const untilIso = endOfLocalDayUtc(now, r.tz).toISOString();
  const instance = await loadInstance(r.instance_id);
  if (!instance) {
    await supabase.from("scheduled_report_runs").insert({
      report_id: r.id, clinic_id: r.clinic_id, status: "error", error: "instance not found",
    });
    return { error: "instance_not_found" };
  }

  try {
    const metrics = await computeMetrics(supabase, r.clinic_id, sinceIso, untilIso, r.metrics || {});
    const text = buildMessage(r.name || "Relatório do dia", lp.dmy, metrics, r.metrics || {});
    await sendToGroup(instance, r.group_jid, text);

    await supabase.from("scheduled_report_runs").insert({
      report_id: r.id, clinic_id: r.clinic_id, status: "success",
      metrics, message_preview: text.slice(0, 500),
    });
    await supabase.from("scheduled_reports").update({
      last_sent_at: now.toISOString(), last_status: "success", last_error: null,
    }).eq("id", r.id);
    return { ok: true, text };
  } catch (e) {
    const msg = String((e as Error).message || e);
    await supabase.from("scheduled_report_runs").insert({
      report_id: r.id, clinic_id: r.clinic_id, status: "error", error: msg.slice(0, 500),
    });
    await supabase.from("scheduled_reports").update({
      last_status: "error", last_error: msg.slice(0, 500),
    }).eq("id", r.id);
    return { error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  // Allow manual "Enviar agora" by passing report_id (requires service-role bearer or authed user)
  let manualReportId: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      manualReportId = body?.report_id ?? null;
    } catch {}
  }

  try {
    if (manualReportId) {
      const { data: r } = await supabase
        .from("scheduled_reports").select("*").eq("id", manualReportId).maybeSingle();
      if (!r) return json({ error: "report not found" }, 404);
      const result = await processReport(supabase, r as Report, { force: true });
      return json({ ok: true, result });
    }

    const { data: reports } = await supabase
      .from("scheduled_reports").select("*").eq("enabled", true);
    const summary: any[] = [];
    for (const r of (reports ?? []) as Report[]) {
      const res = await processReport(supabase, r);
      summary.push({ id: r.id, name: r.name, ...res });
    }
    return json({ ok: true, summary });
  } catch (e) {
    console.error("scheduled-report-tick", e);
    return json({ error: String(e) }, 500);
  }
});

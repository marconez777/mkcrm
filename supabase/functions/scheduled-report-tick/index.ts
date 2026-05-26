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

/** Returns how many ms `tz` is offset from UTC at the given instant. */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts: Record<string, string> = Object.fromEntries(
    dtf.formatToParts(date).map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour === 24 ? 0 : +parts.hour, +parts.minute, +parts.second,
  );
  return asUTC - date.getTime();
}

/** Compute the UTC instant for local midnight (today) in the given tz. */
function startOfLocalDayUtc(now: Date, tz: string): Date {
  const lp = localParts(now, tz);
  const [y, m, d] = lp.ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offset = tzOffsetMs(new Date(guess), tz);
  return new Date(guess - offset);
}

/** End of local day = start of next local day. */
function endOfLocalDayUtc(now: Date, tz: string): Date {
  const start = startOfLocalDayUtc(now, tz);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Calcula as métricas do dia usando EXATAMENTE as mesmas consultas dos cards
 * em /tracking (src/pages/Tracking.tsx). Janela: [sinceIso, untilIso] inclusivo,
 * casando com o `gte/lte` usado no dashboard.
 */
async function computeMetrics(
  supabase: any,
  clinicId: string,
  sinceIso: string,
  untilIso: string,
  want: Record<string, boolean>,
) {
  const out: Record<string, number> = {};

  // 1) Visitantes únicos — tracking_visitors por last_seen_at (mesmo do card).
  //    Também usamos a lista de visitor_ids para calcular Leads identificados,
  //    seguindo o linkMap do dashboard (links indexados por visitor_id na janela).
  let visitorIds: string[] = [];
  {
    const { data: vData, count } = await supabase
      .from("tracking_visitors")
      .select("visitor_id", { count: "exact" })
      .eq("clinic_id", clinicId)
      .gte("last_seen_at", sinceIso)
      .lte("last_seen_at", untilIso)
      .limit(2000);
    visitorIds = ((vData ?? []) as Array<{ visitor_id: string }>).map((v) => v.visitor_id);
    if (want.unique_visitors !== false) out.unique_visitors = count ?? visitorIds.length;
  }

  // 2) Cliques no WhatsApp — eventos whatsapp_click + whatsapp_redirect na janela.
  if (want.whatsapp_clicks !== false) {
    const { count } = await supabase
      .from("tracking_events")
      .select("event_id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("event_time", sinceIso)
      .lte("event_time", untilIso)
      .in("event_name", ["whatsapp_click", "whatsapp_redirect"]);
    out.whatsapp_clicks = count ?? 0;
  }

  // 3/4) Leads identificados — mesma lógica do dashboard: pega os links
  // dos visitantes que aparecem na janela e separa por link_source.
  if (want.form_leads !== false || want.whatsapp_leads !== false) {
    const formLeads = new Set<string>();
    const waLeads = new Set<string>();

    if (visitorIds.length) {
      const { data: links } = await supabase
        .from("tracking_identity_links")
        .select("visitor_id, lead_id, link_source")
        .in("visitor_id", visitorIds);

      // dedupe por visitor — primeiro link vence (igual ao linkMap do dashboard)
      const perVisitor: Record<string, { lead_id: string; link_source: string | null }> = {};
      for (const l of (links ?? []) as Array<{ visitor_id: string; lead_id: string; link_source: string | null }>) {
        if (!perVisitor[l.visitor_id]) perVisitor[l.visitor_id] = { lead_id: l.lead_id, link_source: l.link_source };
      }

      for (const { lead_id, link_source } of Object.values(perVisitor)) {
        const src = String(link_source || "").toLowerCase();
        // isWhatsappSource() do dashboard + phone_hash_existing (origem WA por telefone).
        const isWa = src.startsWith("whatsapp_") || src === "ctwa_clid" || src === "phone_hash_existing";
        if (isWa) waLeads.add(lead_id);
        else formLeads.add(lead_id);
      }
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

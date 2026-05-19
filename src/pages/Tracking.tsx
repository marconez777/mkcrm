import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Eye, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { AttributionTab } from "@/pages/tracking/AttributionTab";

function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void; }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Itens por página:</span>
        <Select value={String(pageSize)} onValueChange={(v) => { onPageSizeChange(Number(v)); onPageChange(1); }}>
          <SelectTrigger className="h-7 w-20"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[25, 50, 100, 200, 500].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span>{start}–{end} de {total}</span>
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>Página {safePage}/{totalPages}</span>
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

type EventRow = {
  id: string;
  event_id: string;
  event_name: string;
  event_type: string;
  event_time: string;
  visitor_id: string;
  session_id: string | null;
  lead_id?: string | null;
  page_url: string | null;
  page_path: string | null;
  page_title: string | null;
  referrer: string | null;
  properties: any;
};

type VisitorRow = {
  visitor_id: string;
  first_seen_at: string;
  last_seen_at: string;
  first_landing_page: string | null;
  first_referrer: string | null;
  first_source: string | null;
  first_medium: string | null;
  first_campaign: string | null;
  last_source: string | null;
  last_medium: string | null;
  last_campaign: string | null;
  last_channel_group: string | null;
  last_non_direct_source: string | null;
  last_non_direct_medium: string | null;
  last_non_direct_campaign: string | null;
  last_non_direct_channel_group: string | null;
};

type SessionRow = {
  session_id: string;
  visitor_id: string;
  started_at: string;
  ended_at: string | null;
  landing_page: string | null;
  referrer: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
};

type LinkRow = {
  visitor_id: string;
  lead_id: string;
  created_at: string;
  linked_at: string | null;
  link_source: string | null;
  leads?: { id: string; name: string | null; created_at: string; stage_id: string | null } | null;
};

const PERIODS = {
  today: { label: "Hoje", ms: 0 },
  "24h": { label: "Últimas 24 horas", ms: 24 * 60 * 60 * 1000 },
  "7d": { label: "Últimos 7 dias", ms: 7 * 24 * 60 * 60 * 1000 },
  "30d": { label: "Últimos 30 dias", ms: 30 * 24 * 60 * 60 * 1000 },
  custom: { label: "Personalizado", ms: -1 },
} as const;
type PeriodKey = keyof typeof PERIODS;

function fmtTime(s?: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}
function fmtHour(s?: string | null) {
  if (!s) return "";
  try { return new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
function truncate(s: string | null | undefined, n = 60) {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
function pathOf(u?: string | null) {
  if (!u) return "—";
  try { return new URL(u).pathname || "/"; } catch { return u; }
}
const REFERRER_NAMES: { match: RegExp; name: string }[] = [
  { match: /google\./i, name: "Google" },
  { match: /bing\./i, name: "Bing" },
  { match: /duckduckgo\./i, name: "DuckDuckGo" },
  { match: /yahoo\./i, name: "Yahoo" },
  { match: /facebook\.|fb\.com|fb\.me/i, name: "Facebook" },
  { match: /instagram\./i, name: "Instagram" },
  { match: /l\.instagram\./i, name: "Instagram" },
  { match: /linkedin\./i, name: "LinkedIn" },
  { match: /t\.co|twitter\.|x\.com/i, name: "Twitter/X" },
  { match: /youtube\.|youtu\.be/i, name: "YouTube" },
  { match: /tiktok\./i, name: "TikTok" },
  { match: /whatsapp\.|wa\.me|api\.whatsapp/i, name: "WhatsApp" },
  { match: /t\.me|telegram\./i, name: "Telegram" },
  { match: /reddit\./i, name: "Reddit" },
  { match: /pinterest\./i, name: "Pinterest" },
];
function referrerName(u?: string | null) {
  if (!u) return "—";
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    const hit = REFERRER_NAMES.find((r) => r.match.test(host));
    return hit ? hit.name : host;
  } catch { return u; }
}

const CONVERSION_LABELS: Record<string, string> = {
  whatsapp_tracking_code: "WhatsApp (código)",
  whatsapp_redirect: "WhatsApp (redirect)",
  whatsapp_click: "WhatsApp (clique)",
  whatsapp_intent_recent_unique: "WhatsApp (intent)",
  whatsapp_event_recent_unique: "WhatsApp (clique)",
  ctwa_clid: "Anúncio WhatsApp (ctwa)",
  phone_hash_existing: "Telefone conhecido",
  partial_form_capture: "Formulário (parcial)",
  form_submit_attempt: "Formulário (envio)",
  form_submit: "Formulário (envio)",
  manual: "Manual",
};
function labelConversion(src?: string | null) {
  if (!src) return "—";
  return CONVERSION_LABELS[src] ?? src;
}
function isWhatsappSource(src?: string | null) {
  if (!src) return false;
  return src.startsWith("whatsapp_") || src === "ctwa_clid";
}

function SourceCell({ source, medium, campaign, channelGroup }: { source: string | null; medium: string | null; campaign: string | null; channelGroup?: string | null }) {
  if (!source && !medium && !campaign) return <span className="text-muted-foreground">—</span>;
  const label = source || "(direct)";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">{label}{medium ? ` / ${medium}` : ""}</span>
      {campaign && <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">{campaign}</span>}
      {channelGroup && <Badge variant="outline" className="w-fit text-[10px]">{channelGroup}</Badge>}
    </div>
  );
}

export default function Tracking() {
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const { isSuperAdmin, membership } = useAuth();
  const debugAvailable = isSuperAdmin || (membership?.clinic?.settings as any)?.tracking?.debug_enabled === true;

  // global filters
  const [eventNameFilter, setEventNameFilter] = useState("");
  const [visitorFilter, setVisitorFilter] = useState("");
  const [leadFilter, setLeadFilter] = useState("");
  const [pageUrlFilter, setPageUrlFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("__all__");
  const [onlyAnon, setOnlyAnon] = useState(false);
  const [onlyLeads, setOnlyLeads] = useState(false);
  const [onlyWhatsapp, setOnlyWhatsapp] = useState(false);
  const [onlyForm, setOnlyForm] = useState(false);

  // data
  const [events, setEvents] = useState<EventRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [links, setLinks] = useState<Record<string, LinkRow>>({});
  const [stages, setStages] = useState<Record<string, { name: string; color: string }>>({});
  const [allEventNames, setAllEventNames] = useState<string[]>([]);

  const [summary, setSummary] = useState({
    visitors: 0, sessions: 0, events: 0, page_view: 0,
    whatsapp_click: 0, form_start: 0, form_submit_attempt: 0,
    leads_identified: 0, visitors_with_lead: 0, conv_rate: 0,
  });

  // visitor-level booleans
  const [vFlags, setVFlags] = useState<Record<string, { wa: boolean; fs: boolean; fa: boolean; sessions: number; events: number; lastPage: string | null }>>({});

  // journey modal
  const [journeyVisitor, setJourneyVisitor] = useState<string | null>(null);
  const [journeyData, setJourneyData] = useState<{ visitor: VisitorRow | null; sessions: SessionRow[]; events: EventRow[] } | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);

  // pagination per tab
  const [pageSize, setPageSize] = useState(50);
  const [visitorsPage, setVisitorsPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);
  const [leadsPage, setLeadsPage] = useState(1);
  const [pagesPage, setPagesPage] = useState(1);
  const [waPagesPage, setWaPagesPage] = useState(1);

  const computeRange = useCallback(() => {
    const now = Date.now();
    if (period === "custom") {
      const startOfDay = (s: string) => { const d = new Date(s); d.setHours(0, 0, 0, 0); return d.toISOString(); };
      const endOfDay = (s: string) => { const d = new Date(s); d.setHours(23, 59, 59, 999); return d.toISOString(); };
      return {
        sinceISO: customFrom ? startOfDay(customFrom) : new Date(now - 7 * 86400_000).toISOString(),
        untilISO: customTo ? endOfDay(customTo) : new Date().toISOString(),
      };
    }
    if (period === "today") {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      return { sinceISO: d.toISOString(), untilISO: new Date().toISOString() };
    }
    return { sinceISO: new Date(now - PERIODS[period].ms).toISOString(), untilISO: new Date().toISOString() };
  }, [period, customFrom, customTo]);

  const { sinceISO, untilISO } = useMemo(() => computeRange(), [computeRange]);

  const load = useCallback(async () => {
    setLoading(true);
    const { sinceISO, untilISO } = computeRange();
    try {
      // pull events in window — used for summary, tables, flags, pages report
      let evq = supabase.from("tracking_events").select("*")
        .gte("event_time", sinceISO).lte("event_time", untilISO)
        .order("event_time", { ascending: false }).limit(5000);
      if (eventNameFilter.trim()) evq = evq.ilike("event_name", `%${eventNameFilter.trim()}%`);
      if (visitorFilter.trim()) evq = evq.ilike("visitor_id", `%${visitorFilter.trim()}%`);
      if (leadFilter.trim()) evq = evq.ilike("lead_id", `%${leadFilter.trim()}%`);
      if (pageUrlFilter.trim()) evq = evq.ilike("page_url", `%${pageUrlFilter.trim()}%`);
      const { data: evData } = await evq;
      const allEv = (evData as EventRow[]) ?? [];
      setEvents(allEv);
      setAllEventNames(Array.from(new Set(allEv.map((e) => e.event_name))).sort());

      // visitors in window
      let vq = supabase.from("tracking_visitors").select("visitor_id, first_seen_at, last_seen_at, first_landing_page, first_referrer, first_source, first_medium, first_campaign, last_source, last_medium, last_campaign, last_channel_group, last_non_direct_source, last_non_direct_medium, last_non_direct_campaign, last_non_direct_channel_group")
        .gte("last_seen_at", sinceISO).lte("last_seen_at", untilISO)
        .order("last_seen_at", { ascending: false }).limit(1000);
      if (visitorFilter.trim()) vq = vq.ilike("visitor_id", `%${visitorFilter.trim()}%`);
      const { data: vData } = await vq;
      const vList = (vData as VisitorRow[]) ?? [];
      setVisitors(vList);

      // sessions count (just total in window for summary)
      const { count: sessCount } = await supabase.from("tracking_sessions")
        .select("session_id", { count: "exact", head: true })
        .gte("started_at", sinceISO).lte("started_at", untilISO);

      // identity links for these visitors
      const ids = vList.map((v) => v.visitor_id);
      const linkMap: Record<string, LinkRow> = {};
      if (ids.length) {
        const { data: linkData } = await supabase
          .from("tracking_identity_links")
          .select("visitor_id, lead_id, created_at, linked_at, link_source, leads(id, name, created_at, stage_id)")
          .in("visitor_id", ids);
        (linkData as any[] | null)?.forEach((l) => {
          if (!linkMap[l.visitor_id]) linkMap[l.visitor_id] = l;
        });
      }
      setLinks(linkMap);

      // stages
      const { data: stageData } = await supabase.from("pipeline_stages").select("id, name, color");
      const stageMap: Record<string, { name: string; color: string }> = {};
      (stageData ?? []).forEach((s: any) => { stageMap[s.id] = { name: s.name, color: s.color }; });
      setStages(stageMap);

      // compute per-visitor flags from events
      const flags: typeof vFlags = {};
      const visitorSessions: Record<string, Set<string>> = {};
      allEv.forEach((e) => {
        const f = flags[e.visitor_id] ?? { wa: false, fs: false, fa: false, sessions: 0, events: 0, lastPage: null };
        f.events += 1;
        if (e.event_name === "whatsapp_click" || e.event_name === "whatsapp_redirect") f.wa = true;
        if (e.event_name === "form_start" || e.event_name === "partial_form_capture") f.fs = true;
        if (e.event_name === "form_submit_attempt" || e.event_name === "form_submit") f.fa = true;
        if (!f.lastPage && e.page_url) f.lastPage = e.page_url;
        flags[e.visitor_id] = f;
        if (e.session_id) {
          if (!visitorSessions[e.visitor_id]) visitorSessions[e.visitor_id] = new Set();
          visitorSessions[e.visitor_id].add(e.session_id);
        }
      });
      Object.entries(visitorSessions).forEach(([vid, set]) => {
        if (flags[vid]) flags[vid].sessions = set.size;
      });
      setVFlags(flags);

      // summary
      const totalLeads = Object.keys(linkMap).length;
      const pv = allEv.filter((e) => e.event_name === "page_view").length;
      const wa = allEv.filter((e) => e.event_name === "whatsapp_click" || e.event_name === "whatsapp_redirect").length;
      const fs = allEv.filter((e) => e.event_name === "form_start" || e.event_name === "partial_form_capture").length;
      const fa = allEv.filter((e) => e.event_name === "form_submit_attempt").length;
      setSummary({
        visitors: vList.length,
        sessions: sessCount ?? 0,
        events: allEv.length,
        page_view: pv,
        whatsapp_click: wa,
        form_start: fs,
        form_submit_attempt: fa,
        leads_identified: totalLeads,
        visitors_with_lead: totalLeads,
        conv_rate: vList.length ? (totalLeads / vList.length) * 100 : 0,
      });
    } finally {
      setLoading(false);
    }
  }, [computeRange, eventNameFilter, visitorFilter, leadFilter, pageUrlFilter]);

  useEffect(() => { load(); }, [load]);

  const openJourney = async (visitorId: string) => {
    setJourneyVisitor(visitorId);
    setJourneyLoading(true);
    setJourneyData(null);
    try {
      const [v, s, e] = await Promise.all([
        supabase.from("tracking_visitors").select("*").eq("visitor_id", visitorId).maybeSingle(),
        supabase.from("tracking_sessions").select("*").eq("visitor_id", visitorId).order("started_at", { ascending: false }).limit(50),
        supabase.from("tracking_events").select("*").eq("visitor_id", visitorId).order("event_time", { ascending: true }).limit(500),
      ]);
      setJourneyData({
        visitor: (v.data as VisitorRow) ?? null,
        sessions: (s.data as SessionRow[]) ?? [],
        events: (e.data as EventRow[]) ?? [],
      });
    } finally {
      setJourneyLoading(false);
    }
  };

  // filtered visitors based on chip filters
  const filteredVisitors = useMemo(() => {
    return visitors.filter((v) => {
      const f = vFlags[v.visitor_id];
      const link = links[v.visitor_id];
      if (onlyAnon && link) return false;
      if (onlyLeads && !link) return false;
      if (onlyWhatsapp && !f?.wa) return false;
      if (onlyForm && !(f?.fs || f?.fa)) return false;
      if (stageFilter !== "__all__") {
        if (!link?.leads?.stage_id || link.leads.stage_id !== stageFilter) return false;
      }
      return true;
    });
  }, [visitors, vFlags, links, onlyAnon, onlyLeads, onlyWhatsapp, onlyForm, stageFilter]);

  // page report
  const pageReport = useMemo(() => {
    const map: Record<string, { pageviews: number; visitors: Set<string>; wa: number; fs: number; fa: number; leads: Set<string> }> = {};
    events.forEach((e) => {
      const key = pathOf(e.page_url);
      if (!map[key]) map[key] = { pageviews: 0, visitors: new Set(), wa: 0, fs: 0, fa: 0, leads: new Set() };
      const r = map[key];
      if (e.event_name === "page_view") r.pageviews += 1;
      if (e.event_name === "whatsapp_click" || e.event_name === "whatsapp_redirect") r.wa += 1;
      if (e.event_name === "form_start" || e.event_name === "partial_form_capture") r.fs += 1;
      if (e.event_name === "form_submit_attempt") r.fa += 1;
      r.visitors.add(e.visitor_id);
      const ld = links[e.visitor_id];
      if (ld) r.leads.add(ld.lead_id);
    });
    return Object.entries(map).map(([page, r]) => ({
      page, pageviews: r.pageviews, visitors: r.visitors.size, wa: r.wa, fs: r.fs, fa: r.fa,
      leads: r.leads.size, conv: r.visitors.size ? (r.leads.size / r.visitors.size) * 100 : 0,
    })).sort((a, b) => b.pageviews - a.pageviews);
  }, [events, links]);

  // whatsapp report
  const whatsappReport = useMemo(() => {
    const waEvents = events.filter((e) => e.event_name === "whatsapp_click" || e.event_name === "whatsapp_redirect");
    const uniqueVisitors = new Set(waEvents.map((e) => e.visitor_id));
    const pageMap: Record<string, number> = {};
    waEvents.forEach((e) => { const k = pathOf(e.page_url); pageMap[k] = (pageMap[k] ?? 0) + 1; });
    const turnedLead = Array.from(uniqueVisitors).filter((v) => links[v]).length;
    return {
      total: waEvents.length,
      uniqueVisitors: uniqueVisitors.size,
      topPages: Object.entries(pageMap).sort((a, b) => b[1] - a[1]),
      turnedLead,
      conv: uniqueVisitors.size ? (turnedLead / uniqueVisitors.size) * 100 : 0,
    };
  }, [events, links]);

  const leadsWithOrigin = useMemo(() => {
    const CONV_EVENTS = new Set([
      "whatsapp_redirect", "whatsapp_click",
      "partial_form_capture", "form_submit_attempt", "form_submit",
    ]);
    return Object.values(links).map((l) => {
      const v = visitors.find((x) => x.visitor_id === l.visitor_id);
      // Prefer the authoritative link source (set by tracking-identify / webhook).
      const sourceLabel = labelConversion(l.link_source);
      // For the conversion page, find the closest matching event near link.created_at.
      const linkedAt = l.linked_at ? new Date(l.linked_at).getTime() : (l.created_at ? new Date(l.created_at).getTime() : 0);
      const candidates = events.filter((e) => e.visitor_id === l.visitor_id && CONV_EVENTS.has(e.event_name));
      const conversion = candidates.sort((a, b) => {
        const da = Math.abs(new Date(a.event_time).getTime() - linkedAt);
        const db = Math.abs(new Date(b.event_time).getTime() - linkedAt);
        return da - db;
      })[0];
      return {
        link: l,
        visitor: v,
        conversionEvent: sourceLabel !== "—" ? sourceLabel : labelConversion(conversion?.event_name),
        conversionPage: conversion ? pathOf(conversion.page_url) : "—",
        isWhatsapp: isWhatsappSource(l.link_source) || conversion?.event_name?.startsWith("whatsapp_"),
        stage: l.leads?.stage_id ? stages[l.leads.stage_id]?.name ?? "—" : "—",
      };
    }).sort((a, b) => (b.link.created_at || "").localeCompare(a.link.created_at || ""));
  }, [links, visitors, events, stages]);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tracking</h1>
          <p className="text-sm text-muted-foreground">Visão geral consolidada de visitantes, sessões, eventos e conversão em leads.</p>
        </div>
        <div className="flex items-center gap-2">
          {debugAvailable && (
            <>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={debugMode} onCheckedChange={(v) => setDebugMode(!!v)} /> Debug
              </label>
              {debugMode && (
                <Button asChild size="sm" variant="outline">
                  <RouterLink to="/tracking-debug">Auditoria / Debug</RouterLink>
                </Button>
              )}
            </>
          )}
          <Button onClick={load} disabled={loading} size="sm">
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar dados
          </Button>
        </div>
      </div>

      {/* Filtros globais */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Filtros globais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Período</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PERIODS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">De</label>
                <Input type="datetime-local" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Até</label>
                <Input type="datetime-local" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">event_name</label>
            <Input value={eventNameFilter} onChange={(e) => setEventNameFilter(e.target.value)} placeholder="ex: page_view" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">visitor_id</label>
            <Input value={visitorFilter} onChange={(e) => setVisitorFilter(e.target.value)} placeholder="parcial..." />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">lead_id</label>
            <Input value={leadFilter} onChange={(e) => setLeadFilter(e.target.value)} placeholder="parcial..." />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">page_url</label>
            <Input value={pageUrlFilter} onChange={(e) => setPageUrlFilter(e.target.value)} placeholder="parcial..." />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Etapa do Funil</label>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {Object.entries(stages).map(([id, s]) => <SelectItem key={id} value={id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-full flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={onlyAnon} onCheckedChange={(v) => setOnlyAnon(!!v)} /> Apenas anônimos</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={onlyLeads} onCheckedChange={(v) => setOnlyLeads(!!v)} /> Apenas viraram lead</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={onlyWhatsapp} onCheckedChange={(v) => setOnlyWhatsapp(!!v)} /> Com clique no WhatsApp</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={onlyForm} onCheckedChange={(v) => setOnlyForm(!!v)} /> Com formulário</label>
          </div>
        </CardContent>
      </Card>

      {/* Cards de visão geral */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "Visitantes únicos", value: summary.visitors },
          { label: "Sessões", value: summary.sessions },
          { label: "Eventos totais", value: summary.events },
          { label: "Pageviews", value: summary.page_view },
          { label: "Clique WhatsApp", value: summary.whatsapp_click },
          { label: "Formulários iniciados", value: summary.form_start },
          { label: "Form. tent. envio", value: summary.form_submit_attempt },
          { label: "Leads identificados", value: summary.leads_identified },
          { label: "Visitantes → Lead", value: summary.visitors_with_lead },
          { label: "Taxa visitante → lead", value: `${summary.conv_rate.toFixed(1)}%` },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent className="pt-0 text-2xl font-semibold">{c.value}</CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="visitors">
        <TabsList>
          <TabsTrigger value="visitors">Visitantes</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="leads">Leads com origem</TabsTrigger>
          <TabsTrigger value="pages">Páginas</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="attribution">Atribuição</TabsTrigger>
        </TabsList>

        {/* Visitantes */}
        <TabsContent value="visitors">
          <Card>
            <CardHeader><CardTitle className="text-sm">Visitantes ({filteredVisitors.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Página</TableHead>
                    <TableHead>Referrer</TableHead>
                    <TableHead className="text-center" title="Clique no botão OU redirect rastreado para WhatsApp">WA</TableHead>
                    <TableHead className="text-center" title="form_start ou captura parcial de formulário">Form</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Etapa do Funil</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVisitors.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum visitante encontrado.</TableCell></TableRow>
                  )}
                  {filteredVisitors.slice((visitorsPage - 1) * pageSize, visitorsPage * pageSize).map((v) => {
                    const f = vFlags[v.visitor_id];
                    const link = links[v.visitor_id];
                    const stage = link?.leads?.stage_id ? stages[link.leads.stage_id] : null;
                    const pagePath = pathOf(v.first_landing_page);
                    return (
                      <TableRow key={v.visitor_id}>
                        
                        <TableCell className="text-[11px] whitespace-nowrap leading-tight">
                          <div>{fmtDate(v.first_seen_at)}</div>
                          <div className="text-muted-foreground">{fmtHour(v.first_seen_at)}</div>
                        </TableCell>
                        <TableCell className="text-[11px]">
                          {v.first_landing_page ? (
                            <a href={v.first_landing_page} target="_blank" rel="noreferrer" className="text-primary hover:underline whitespace-nowrap">{pagePath}</a>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-[11px]">{referrerName(v.first_referrer)}</TableCell>
                        <TableCell className="text-center">{(f?.wa || isWhatsappSource(link?.link_source)) ? <Badge variant="default">sim</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-center">{f?.fs ? <Badge variant="secondary">sim</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs">
                          {link ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {isWhatsappSource(link.link_source) ? (
                                <Badge variant="default" className="bg-green-600 hover:bg-green-600">WhatsApp</Badge>
                              ) : (
                                <Badge variant="secondary">sim</Badge>
                              )}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {stage ? <Badge style={{ backgroundColor: stage.color, color: "white" }}>{stage.name}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => openJourney(v.visitor_id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination page={visitorsPage} pageSize={pageSize} total={filteredVisitors.length} onPageChange={setVisitorsPage} onPageSizeChange={setPageSize} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Eventos */}
        <TabsContent value="events">
          <Card>
            <CardHeader><CardTitle className="text-sm">Eventos ({events.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>event_time</TableHead>
                    <TableHead>event_name</TableHead>
                    <TableHead>visitor_id</TableHead>
                    <TableHead>session_id</TableHead>
                    <TableHead>lead_id</TableHead>
                    <TableHead>page_url</TableHead>
                    <TableHead>referrer</TableHead>
                    <TableHead>properties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum evento encontrado.</TableCell></TableRow>
                  )}
                  {events.slice((eventsPage - 1) * pageSize, eventsPage * pageSize).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs">{fmtTime(e.event_time)}</TableCell>
                      <TableCell className="font-mono text-xs">{e.event_name}</TableCell>
                      <TableCell className="font-mono text-xs">{truncate(e.visitor_id, 14)}</TableCell>
                      <TableCell className="font-mono text-xs">{truncate(e.session_id, 14)}</TableCell>
                      <TableCell className="font-mono text-xs">{e.lead_id ? truncate(e.lead_id, 10) : "—"}</TableCell>
                      <TableCell className="text-xs"><span title={e.page_url ?? ""}>{truncate(e.page_url, 40)}</span></TableCell>
                      <TableCell className="text-xs"><span title={e.referrer ?? ""}>{truncate(e.referrer, 28)}</span></TableCell>
                      <TableCell className="max-w-[260px]">
                        <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{JSON.stringify(e.properties ?? {}, null, 0)}</pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={eventsPage} pageSize={pageSize} total={events.length} onPageChange={setEventsPage} onPageSizeChange={setPageSize} />
              {allEventNames.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Eventos encontrados no período: {allEventNames.join(", ")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leads com origem */}
        <TabsContent value="leads">
          <Card>
            <CardHeader><CardTitle className="text-sm">Leads com origem ({leadsWithOrigin.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>visitor_id</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead>1ª visita</TableHead>
                    <TableHead>1ª página</TableHead>
                    <TableHead>Página conversão</TableHead>
                    <TableHead>Referrer</TableHead>
                    <TableHead>Evento conv.</TableHead>
                    <TableHead>Etapa do Funil</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsWithOrigin.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Nenhum lead vinculado.</TableCell></TableRow>
                  )}
                  {leadsWithOrigin.slice((leadsPage - 1) * pageSize, leadsPage * pageSize).map(({ link, visitor, conversionEvent, conversionPage, stage, isWhatsapp }) => (
                    <TableRow key={link.lead_id + link.visitor_id}>
                      <TableCell className="text-xs">
                        <RouterLink to={`/?lead=${link.lead_id}`} className="text-primary hover:underline">
                          {link.leads?.name || truncate(link.lead_id, 8)}
                        </RouterLink>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{truncate(link.visitor_id, 14)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtTime(link.leads?.created_at)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtTime(visitor?.first_seen_at)}</TableCell>
                      <TableCell className="text-xs">{truncate(pathOf(visitor?.first_landing_page), 24)}</TableCell>
                      <TableCell className="text-xs">{conversionPage}</TableCell>
                      <TableCell className="text-xs">{truncate(visitor?.first_referrer, 24)}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>{conversionEvent}</span>
                          {isWhatsapp && <Badge variant="default" className="bg-green-600 hover:bg-green-600">WhatsApp</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{stage}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => openJourney(link.visitor_id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={leadsPage} pageSize={pageSize} total={leadsWithOrigin.length} onPageChange={setLeadsPage} onPageSizeChange={setPageSize} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Páginas */}
        <TabsContent value="pages">
          <Card>
            <CardHeader><CardTitle className="text-sm">Desempenho por página ({pageReport.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Página</TableHead>
                    <TableHead className="text-right">Pageviews</TableHead>
                    <TableHead className="text-right">Visitantes</TableHead>
                    <TableHead className="text-right">WhatsApp</TableHead>
                    <TableHead className="text-right">Form. iniciado</TableHead>
                    <TableHead className="text-right">Form. tent.</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Conv. %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageReport.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
                  )}
                  {pageReport.slice((pagesPage - 1) * pageSize, pagesPage * pageSize).map((p) => (
                    <TableRow key={p.page}>
                      <TableCell className="text-xs">{p.page}</TableCell>
                      <TableCell className="text-right text-xs">{p.pageviews}</TableCell>
                      <TableCell className="text-right text-xs">{p.visitors}</TableCell>
                      <TableCell className="text-right text-xs">{p.wa}</TableCell>
                      <TableCell className="text-right text-xs">{p.fs}</TableCell>
                      <TableCell className="text-right text-xs">{p.fa}</TableCell>
                      <TableCell className="text-right text-xs">{p.leads}</TableCell>
                      <TableCell className="text-right text-xs">{p.conv.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={pagesPage} pageSize={pageSize} total={pageReport.length} onPageChange={setPagesPage} onPageSizeChange={setPageSize} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp */}
        <TabsContent value="whatsapp">
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Cliques WhatsApp</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{whatsappReport.total}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Visitantes únicos</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{whatsappReport.uniqueVisitors}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Viraram lead</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{whatsappReport.turnedLead}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Taxa WA → lead</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-semibold">{whatsappReport.conv.toFixed(1)}%</CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Páginas que mais geraram clique no WhatsApp</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Página</TableHead><TableHead className="text-right">Cliques</TableHead></TableRow></TableHeader>
                <TableBody>
                  {whatsappReport.topPages.length === 0 && (
                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
                  )}
                  {whatsappReport.topPages.slice((waPagesPage - 1) * pageSize, waPagesPage * pageSize).map(([page, n]) => (
                    <TableRow key={page}><TableCell className="text-xs">{page}</TableCell><TableCell className="text-right text-xs">{n}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={waPagesPage} pageSize={pageSize} total={whatsappReport.topPages.length} onPageChange={setWaPagesPage} onPageSizeChange={setPageSize} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attribution">
          {membership?.clinic?.id ? (
            <AttributionTab clinicId={membership.clinic.id} from={sinceISO} to={untilISO} />
          ) : (
            <p className="text-sm text-muted-foreground">Sem clínica selecionada.</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Jornada modal */}
      <Dialog open={!!journeyVisitor} onOpenChange={(o) => { if (!o) { setJourneyVisitor(null); setJourneyData(null); } }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle className="font-mono text-sm">Jornada — {journeyVisitor}</DialogTitle></DialogHeader>
          {journeyLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {journeyData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                <div><div className="text-muted-foreground">1ª visita</div><div>{fmtTime(journeyData.visitor?.first_seen_at)}</div></div>
                <div><div className="text-muted-foreground">Última visita</div><div>{fmtTime(journeyData.visitor?.last_seen_at)}</div></div>
                <div><div className="text-muted-foreground">Sessões</div><div>{journeyData.sessions.length}</div></div>
                <div><div className="text-muted-foreground">Eventos</div><div>{journeyData.events.length}</div></div>
              </div>
              {journeyVisitor && links[journeyVisitor] && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Lead vinculado</CardTitle></CardHeader>
                  <CardContent className="pt-0 text-sm">
                    <RouterLink to={`/?lead=${links[journeyVisitor].lead_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                      {links[journeyVisitor].leads?.name || links[journeyVisitor].lead_id} <ExternalLink className="h-3 w-3" />
                    </RouterLink>
                  </CardContent>
                </Card>
              )}
              <div>
                <h4 className="mb-2 text-sm font-semibold">Linha do tempo</h4>
                <div className="space-y-1">
                  {journeyData.events.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 rounded border p-2 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">{fmtTime(e.event_time)}</span>
                      <Badge variant="outline" className="font-mono">{e.event_name}</Badge>
                      <span className="flex-1 truncate">{e.page_url}</span>
                    </div>
                  ))}
                  {journeyData.events.length === 0 && <p className="text-xs text-muted-foreground">Sem eventos.</p>}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Sessões</h4>
                <Table>
                  <TableHeader><TableRow><TableHead>Início</TableHead><TableHead>Landing</TableHead><TableHead>Referrer</TableHead><TableHead>Source</TableHead><TableHead>Device</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {journeyData.sessions.map((s) => (
                      <TableRow key={s.session_id}>
                        <TableCell className="text-xs whitespace-nowrap">{fmtTime(s.started_at)}</TableCell>
                        <TableCell className="text-xs">{truncate(pathOf(s.landing_page), 30)}</TableCell>
                        <TableCell className="text-xs">{truncate(s.referrer, 24)}</TableCell>
                        <TableCell className="text-xs">{s.source ?? "—"}</TableCell>
                        <TableCell className="text-xs">{s.device_type ?? "—"} {s.browser ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

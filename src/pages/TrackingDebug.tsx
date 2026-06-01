import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link as RouterLink } from "react-router-dom";
import { linkVisitorToLead } from "@/lib/tracking-identify";

type EventRow = {
  id: string;
  event_id: string;
  event_name: string;
  event_type: string;
  event_time: string;
  visitor_id: string;
  session_id: string | null;
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
  created_at: string;
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
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
  user_agent: string | null;
};

const PERIODS = {
  "1h": { label: "Última 1 hora", ms: 60 * 60 * 1000 },
  "24h": { label: "Últimas 24 horas", ms: 24 * 60 * 60 * 1000 },
  "7d": { label: "Últimos 7 dias", ms: 7 * 24 * 60 * 60 * 1000 },
} as const;
type PeriodKey = keyof typeof PERIODS;
const OR_CLINIC_ID = "cf038458-457d-4c1a-9ac4-c88c3c8353a1";
const OR_PROJECT_ID = "or";

function fmtTime(s?: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function truncate(s: string | null | undefined, n = 60) {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export default function TrackingDebug() {
  const [period, setPeriod] = useState<PeriodKey>("24h");
  const [eventNameFilter, setEventNameFilter] = useState("");
  const [visitorFilter, setVisitorFilter] = useState("");
  const [pageUrlFilter, setPageUrlFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [summary, setSummary] = useState({
    visitors24h: 0, sessions24h: 0, events24h: 0,
    page_view: 0, whatsapp_click: 0, form_start: 0, form_submit_attempt: 0,
  });
  const [journeyVisitor, setJourneyVisitor] = useState<string | null>(null);
  const [journeyData, setJourneyData] = useState<{
    visitor: VisitorRow | null;
    sessions: SessionRow[];
    events: EventRow[];
  } | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [creatingJourney, setCreatingJourney] = useState(false);
  const [linkedByVisitor, setLinkedByVisitor] = useState<Record<string, { lead_id: string; name: string | null }>>({});

  const since = useMemo(() => new Date(Date.now() - PERIODS[period].ms).toISOString(), [period]);
  const since24h = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Summary (always 24h)
      const [v24, s24, e24, evCounts] = await Promise.all([
        supabase.from("tracking_visitors").select("visitor_id", { count: "exact", head: true }).eq("clinic_id", OR_CLINIC_ID).gte("last_seen_at", since24h),
        supabase.from("tracking_sessions").select("session_id", { count: "exact", head: true }).eq("clinic_id", OR_CLINIC_ID).gte("started_at", since24h),
        supabase.from("tracking_events").select("id", { count: "exact", head: true }).eq("clinic_id", OR_CLINIC_ID).gte("event_time", since24h),
        fetchAllPaged<{ event_name: string }>(
          () => supabase.from("tracking_events").select("event_name").eq("clinic_id", OR_CLINIC_ID).gte("event_time", since24h),
          1000,
          100_000,
        ),
      ]);
      const counts: Record<string, number> = {};
      (evCounts ?? []).forEach((r: any) => { counts[r.event_name] = (counts[r.event_name] ?? 0) + 1; });
      setSummary({
        visitors24h: v24.count ?? 0,
        sessions24h: s24.count ?? 0,
        events24h: e24.count ?? 0,
        page_view: counts.page_view ?? 0,
        whatsapp_click: counts.whatsapp_click ?? 0,
        form_start: counts.form_start ?? 0,
        form_submit_attempt: counts.form_submit_attempt ?? 0,
      });

      // Events table
      let q = supabase.from("tracking_events").select("*").eq("clinic_id", OR_CLINIC_ID).gte("event_time", since).order("event_time", { ascending: false }).limit(200);
      if (eventNameFilter.trim()) q = q.ilike("event_name", `%${eventNameFilter.trim()}%`);
      if (visitorFilter.trim()) q = q.ilike("visitor_id", `%${visitorFilter.trim()}%`);
      if (pageUrlFilter.trim()) q = q.ilike("page_url", `%${pageUrlFilter.trim()}%`);
      const { data: evData } = await q;
      setEvents((evData as EventRow[]) ?? []);

      // Visitors table
      let vq = supabase.from("tracking_visitors").select("*").eq("clinic_id", OR_CLINIC_ID).gte("last_seen_at", since).order("last_seen_at", { ascending: false }).limit(100);
      if (visitorFilter.trim()) vq = vq.ilike("visitor_id", `%${visitorFilter.trim()}%`);
      const { data: vData } = await vq;
      const visitorsList = (vData as VisitorRow[]) ?? [];
      setVisitors(visitorsList);

      // Identity links
      const ids = visitorsList.map((v) => v.visitor_id);
      if (ids.length) {
        const { data: links } = await supabase
          .from("tracking_identity_links")
          .select("visitor_id, lead_id, leads(id, name)")
          .eq("clinic_id", OR_CLINIC_ID)
          .in("visitor_id", ids);
        const map: Record<string, { lead_id: string; name: string | null }> = {};
        (links || []).forEach((l: any) => {
          if (!map[l.visitor_id]) map[l.visitor_id] = { lead_id: l.lead_id, name: l.leads?.name ?? null };
        });
        setLinkedByVisitor(map);
      } else {
        setLinkedByVisitor({});
      }
    } finally {
      setLoading(false);
    }
  }, [since, since24h, eventNameFilter, visitorFilter, pageUrlFilter]);

  useEffect(() => { load(); }, [load]);

  const openJourney = async (visitorId: string) => {
    setJourneyVisitor(visitorId);
    setJourneyLoading(true);
    setJourneyData(null);
    try {
      const [v, s, e] = await Promise.all([
        supabase.from("tracking_visitors").select("*").eq("clinic_id", OR_CLINIC_ID).eq("visitor_id", visitorId).maybeSingle(),
        supabase.from("tracking_sessions").select("*").eq("clinic_id", OR_CLINIC_ID).eq("visitor_id", visitorId).order("started_at", { ascending: false }).limit(50),
        supabase.from("tracking_events").select("*").eq("clinic_id", OR_CLINIC_ID).eq("visitor_id", visitorId).order("event_time", { ascending: true }).limit(500),
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

  const pagesVisited = journeyData?.events.filter(e => e.event_name === "page_view") ?? [];
  const whatsappClicks = journeyData?.events.filter(e => e.event_name === "whatsapp_click") ?? [];
  const formEvents = journeyData?.events.filter(e => e.event_name.startsWith("form_")) ?? [];

  const sendTestEvent = async () => {
    setSendingTest(true);
    try {
      const payload = {
        project_id: OR_PROJECT_ID,
        visitor_id: `debug_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
        session_id: `debug_s_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
        event_id: `debug_e_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
        event_name: "test_event",
        event_type: "custom",
        event_time: new Date().toISOString(),
        page_url: window.location.origin + "/tracking-debug?source=internal-test",
        page_path: "/tracking-debug",
        page_title: document.title,
        referrer: window.location.origin,
        properties: {
          source: "tracking_debug",
          button: "Enviar evento de teste",
          clinic_id: OR_CLINIC_ID,
        },
      };

      const { data, error } = await supabase.functions.invoke("tracking-event", {
        body: payload,
      });

      if (error) throw error;
      toast.success("Evento de teste enviado.");
      await load();
      console.log("[tracking-debug] test_event_result", data);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar evento de teste.");
      console.error("[tracking-debug] test_event_error", err);
    } finally {
      setSendingTest(false);
    }
  };

  const createTestJourney = async () => {
    setCreatingJourney(true);
    try {
      // pick most recent lead in this clinic to attach the journey
      const { data: leadRow } = await supabase
        .from("leads").select("id, name")
        .eq("clinic_id", OR_CLINIC_ID)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!leadRow?.id) { toast.error("Nenhum lead disponível para vincular. Crie um lead primeiro."); return; }

      const visitor = `debug_v_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const session = `debug_s_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const base = { project_id: OR_PROJECT_ID, visitor_id: visitor, session_id: session };
      const now = Date.now();
      const events = [
        { event_name: "page_view", event_type: "auto", page_url: "https://clinicaohrpsiquiatria.com/", page_path: "/", ts: now - 60_000 * 5 },
        { event_name: "page_view", event_type: "auto", page_url: "https://clinicaohrpsiquiatria.com/sobre", page_path: "/sobre", ts: now - 60_000 * 4 },
        { event_name: "whatsapp_click", event_type: "auto", page_url: "https://clinicaohrpsiquiatria.com/sobre", page_path: "/sobre", ts: now - 60_000 * 3 },
        { event_name: "form_start", event_type: "auto", page_url: "https://clinicaohrpsiquiatria.com/contato", page_path: "/contato", ts: now - 60_000 * 2 },
      ].map((e) => ({
        ...base,
        event_id: `debug_e_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        event_name: e.event_name,
        event_type: e.event_type,
        event_time: new Date(e.ts).toISOString(),
        page_url: e.page_url,
        page_path: e.page_path,
        page_title: "[TEST]",
        referrer: "https://google.com/",
        properties: { test_mode: true, source: "tracking_debug" },
      }));

      const { error: evErr } = await supabase.functions.invoke("tracking-event", { body: events });
      if (evErr) throw evErr;

      await linkVisitorToLead({
        clinic_id: OR_CLINIC_ID,
        visitor_id: visitor,
        lead_id: leadRow.id,
        session_id: session,
        source_event: "debug_test_journey",
        project_id: OR_PROJECT_ID,
        properties: { test_mode: true },
      });

      toast.success(`Jornada de teste criada e vinculada ao lead ${leadRow.name || leadRow.id.slice(0, 8)}.`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao criar jornada de teste.");
      console.error(err);
    } finally {
      setCreatingJourney(false);
    }
  };
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Auditoria de Tracking</h1>
          <p className="text-sm text-muted-foreground">Validação dos eventos recebidos pelo pixel da clínica.</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">clinic_id: {OR_CLINIC_ID} · project_id: {OR_PROJECT_ID}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={sendTestEvent} disabled={loading || sendingTest || creatingJourney} size="sm" variant="outline">
            {sendingTest ? "Enviando…" : "Enviar evento de teste"}
          </Button>
          <Button onClick={createTestJourney} disabled={loading || sendingTest || creatingJourney} size="sm" variant="outline">
            {creatingJourney ? "Criando…" : "Criar jornada de teste"}
          </Button>
          <Button onClick={load} disabled={loading || sendingTest || creatingJourney} size="sm">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <Card className="mb-4 border-amber-500/40 bg-amber-500/5">
        <CardContent className="py-3 text-sm">
          <strong>Modo de validação:</strong> Para testar, abra o site da Clínica ÓR em uma aba anônima,
          acesse algumas páginas, clique no WhatsApp e interaja com formulários. Depois volte aqui e clique em <em>Atualizar</em>.
        </CardContent>
      </Card>

      {/* Resumo rápido */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {[
          { label: "Visitantes 24h", value: summary.visitors24h },
          { label: "Sessões 24h", value: summary.sessions24h },
          { label: "Eventos 24h", value: summary.events24h },
          { label: "page_view 24h", value: summary.page_view },
          { label: "whatsapp_click 24h", value: summary.whatsapp_click },
          { label: "form_start 24h", value: summary.form_start },
          { label: "form_submit_attempt 24h", value: summary.form_submit_attempt },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent className="pt-0 text-2xl font-semibold">{c.value}</CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Período</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PERIODS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">event_name</label>
            <Input value={eventNameFilter} onChange={(e) => setEventNameFilter(e.target.value)} placeholder="ex: page_view" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">visitor_id</label>
            <Input value={visitorFilter} onChange={(e) => setVisitorFilter(e.target.value)} placeholder="parcial..." />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">page_url</label>
            <Input value={pageUrlFilter} onChange={(e) => setPageUrlFilter(e.target.value)} placeholder="parcial..." />
          </div>
        </CardContent>
      </Card>

      {/* Eventos */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm">Últimos eventos recebidos ({events.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>event_time</TableHead>
                <TableHead>event_name</TableHead>
                <TableHead>visitor_id</TableHead>
                <TableHead>session_id</TableHead>
                <TableHead>page_url</TableHead>
                <TableHead>referrer</TableHead>
                <TableHead>properties</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum evento encontrado.</TableCell></TableRow>
              )}
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs">{fmtTime(e.event_time)}</TableCell>
                  <TableCell className="font-mono text-xs">{e.event_name}</TableCell>
                  <TableCell className="font-mono text-xs">{truncate(e.visitor_id, 16)}</TableCell>
                  <TableCell className="font-mono text-xs">{truncate(e.session_id, 16)}</TableCell>
                  <TableCell className="text-xs"><span title={e.page_url ?? ""}>{truncate(e.page_url, 50)}</span></TableCell>
                  <TableCell className="text-xs"><span title={e.referrer ?? ""}>{truncate(e.referrer, 40)}</span></TableCell>
                  <TableCell className="max-w-[280px]">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{JSON.stringify(e.properties ?? {}, null, 0)}</pre>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openJourney(e.visitor_id)} title="Ver jornada">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Visitantes */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Últimos visitantes ({visitors.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>visitor_id</TableHead>
                <TableHead>lead vinculado</TableHead>
                <TableHead>first_seen_at</TableHead>
                <TableHead>last_seen_at</TableHead>
                <TableHead>first_landing_page</TableHead>
                <TableHead>first_referrer</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitors.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum visitante encontrado.</TableCell></TableRow>
              )}
              {visitors.map((v) => {
                const link = linkedByVisitor[v.visitor_id];
                return (
                <TableRow key={v.visitor_id}>
                  <TableCell className="font-mono text-xs">{truncate(v.visitor_id, 18)}</TableCell>
                  <TableCell className="text-xs">
                    {link ? (
                      <span title={link.lead_id}>{link.name || link.lead_id.slice(0, 8)}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmtTime(v.first_seen_at)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmtTime(v.last_seen_at)}</TableCell>
                  <TableCell className="text-xs"><span title={v.first_landing_page ?? ""}>{truncate(v.first_landing_page, 50)}</span></TableCell>
                  <TableCell className="text-xs"><span title={v.first_referrer ?? ""}>{truncate(v.first_referrer, 40)}</span></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {link && (
                        <Button asChild size="sm" variant="ghost" title="Abrir lead">
                          <RouterLink to={`/kanban?lead=${link.lead_id}`}><ExternalLink className="h-3 w-3" /></RouterLink>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openJourney(v.visitor_id)}>
                        <Eye className="h-3 w-3" /> Ver jornada
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Jornada */}
      <Dialog open={!!journeyVisitor} onOpenChange={(o) => { if (!o) { setJourneyVisitor(null); setJourneyData(null); } }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">Jornada · {journeyVisitor}</DialogTitle>
          </DialogHeader>
          {journeyLoading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>}
          {journeyData && (
            <div className="space-y-5 text-sm">
              {/* Dados básicos */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Dados do visitante</h3>
                {journeyData.visitor ? (
                  <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-xs">
                    <div><span className="text-muted-foreground">first_seen:</span> {fmtTime(journeyData.visitor.first_seen_at)}</div>
                    <div><span className="text-muted-foreground">last_seen:</span> {fmtTime(journeyData.visitor.last_seen_at)}</div>
                    <div><span className="text-muted-foreground">landing:</span> {truncate(journeyData.visitor.first_landing_page, 60)}</div>
                    <div><span className="text-muted-foreground">referrer:</span> {truncate(journeyData.visitor.first_referrer, 60)}</div>
                    <div><span className="text-muted-foreground">source:</span> {journeyData.visitor.first_source ?? "—"}</div>
                    <div><span className="text-muted-foreground">medium:</span> {journeyData.visitor.first_medium ?? "—"}</div>
                    <div><span className="text-muted-foreground">campaign:</span> {journeyData.visitor.first_campaign ?? "—"}</div>
                  </div>
                ) : <div className="text-muted-foreground text-xs">Visitante não encontrado em tracking_visitors.</div>}
              </section>

              {/* Sessões */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Sessões ({journeyData.sessions.length})</h3>
                <div className="space-y-2">
                  {journeyData.sessions.map((s) => (
                    <div key={s.session_id} className="rounded-md border p-2 text-xs">
                      <div className="flex flex-wrap gap-x-4">
                        <span className="font-mono">{truncate(s.session_id, 20)}</span>
                        <span>início: {fmtTime(s.started_at)}</span>
                        <span>landing: {truncate(s.landing_page, 40)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-muted-foreground">
                        {s.source && <span>src={s.source}</span>}
                        {s.medium && <span>med={s.medium}</span>}
                        {s.campaign && <span>camp={s.campaign}</span>}
                        {s.gclid && <span>gclid={truncate(s.gclid, 16)}</span>}
                        {s.fbclid && <span>fbclid={truncate(s.fbclid, 16)}</span>}
                        {s.msclkid && <span>msclkid={truncate(s.msclkid, 16)}</span>}
                        {s.gbraid && <span>gbraid={truncate(s.gbraid, 16)}</span>}
                        {s.wbraid && <span>wbraid={truncate(s.wbraid, 16)}</span>}
                        {s.device_type && <span>{s.device_type}</span>}
                        {s.browser && <span>{s.browser}</span>}
                        {s.operating_system && <span>{s.operating_system}</span>}
                      </div>
                    </div>
                  ))}
                  {journeyData.sessions.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma sessão.</div>}
                </div>
              </section>

              {/* Páginas */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Páginas acessadas ({pagesVisited.length})</h3>
                <ul className="space-y-1 text-xs">
                  {pagesVisited.map((p) => (
                    <li key={p.id}>
                      <span className="text-muted-foreground">{fmtTime(p.event_time)}</span> — {truncate(p.page_url, 80)}
                    </li>
                  ))}
                  {pagesVisited.length === 0 && <li className="text-muted-foreground">—</li>}
                </ul>
              </section>

              {/* WhatsApp */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Cliques em WhatsApp ({whatsappClicks.length})</h3>
                <ul className="space-y-1 text-xs">
                  {whatsappClicks.map((p) => (
                    <li key={p.id}>
                      <span className="text-muted-foreground">{fmtTime(p.event_time)}</span> — em {truncate(p.page_path, 40)}
                      {p.properties?.location ? ` · ${p.properties.location}` : ""}
                    </li>
                  ))}
                  {whatsappClicks.length === 0 && <li className="text-muted-foreground">—</li>}
                </ul>
              </section>

              {/* Formulários */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Eventos de formulário ({formEvents.length})</h3>
                <ul className="space-y-1 text-xs">
                  {formEvents.map((p) => (
                    <li key={p.id}>
                      <span className="text-muted-foreground">{fmtTime(p.event_time)}</span> — <span className="font-mono">{p.event_name}</span> em {truncate(p.page_path, 40)}
                    </li>
                  ))}
                  {formEvents.length === 0 && <li className="text-muted-foreground">—</li>}
                </ul>
              </section>

              {/* Timeline completo */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Todos os eventos em ordem ({journeyData.events.length})</h3>
                <div className="space-y-2">
                  {journeyData.events.map((e) => (
                    <div key={e.id} className="rounded-md border p-2 text-xs">
                      <div className="flex flex-wrap items-center gap-x-3">
                        <span className="text-muted-foreground">{fmtTime(e.event_time)}</span>
                        <span className="font-mono font-semibold">{e.event_name}</span>
                        <span className="text-muted-foreground">{truncate(e.page_path, 40)}</span>
                      </div>
                      {e.properties && Object.keys(e.properties).length > 0 && (
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 text-[10px]">
{JSON.stringify(e.properties, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

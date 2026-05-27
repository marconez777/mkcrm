import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Mail,
  CheckCircle2,
  MousePointerClick,
  AlertTriangle,
  Eye,
  Clock,
  Activity,
} from "lucide-react";
import { useEmailMetrics, aggregateMetrics } from "@/hooks/useEmailMetrics";
import { DomainHealthCard } from "@/components/email/DomainHealthCard";

type Log = {
  id: string;
  template_slug: string | null;
  recipient_email: string;
  subject: string;
  status: string;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  delivered_at: string | null;
  error: string | null;
};

type QueueRow = { status: string };

const RANGES = [
  { id: "24h", label: "24h", hours: 24 },
  { id: "7d", label: "7 dias", hours: 24 * 7 },
  { id: "30d", label: "30 dias", hours: 24 * 30 },
  { id: "90d", label: "90 dias", hours: 24 * 90 },
];

// Unificado: tratamos "sent" e "delivered" como o mesmo conceito ("Entregue")
// para evitar confundir o usuário com "aguardando confirmação".
const STATUS_LABEL: Record<string, string> = {
  sent: "entregue",
  delivered: "entregue",
  opened: "aberto",
  clicked: "clicado",
  failed: "falhou",
  bounced: "bounce",
  complained: "spam",
  queued: "na fila",
};

function statusBadge(s: string) {
  const map: Record<string, "default" | "secondary" | "destructive"> = {
    sent: "default",
    delivered: "default",
    opened: "default",
    clicked: "default",
    failed: "destructive",
    bounced: "destructive",
    complained: "destructive",
    queued: "secondary",
  };
  return <Badge variant={map[s] ?? "secondary"}>{STATUS_LABEL[s] ?? s}</Badge>;
}

const STATUS_COLORS: Record<string, string> = {
  sent: "hsl(var(--primary))",
  delivered: "hsl(var(--primary))",
  opened: "hsl(var(--chart-2, 142 71% 45%))",
  clicked: "hsl(var(--chart-3, 262 83% 58%))",
  failed: "hsl(var(--destructive))",
  bounced: "hsl(var(--destructive))",
  complained: "hsl(var(--destructive))",
};

export default function EmailDashboard() {
  const { membership } = useAuth();
  const clinicId = membership?.clinic_id;
  const [logs, setLogs] = useState<Log[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sentToday, setSentToday] = useState(0);
  const [quota, setQuota] = useState(1000);
  const [range, setRange] = useState(RANGES[1]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  async function load() {
    if (!clinicId) return;
    setLoading(true);
    const since = new Date(Date.now() - range.hours * 3600_000).toISOString();
    const [{ data: ls }, { data: q }, { data: state }, { data: c }] = await Promise.all([
      supabase
        .from("email_logs")
        .select("id,template_slug,recipient_email,subject,status,sent_at,opened_at,clicked_at,bounced_at,delivered_at,error")
        .gte("sent_at", since)
        .order("sent_at", { ascending: false })
        .limit(1000),
      supabase.from("email_queue").select("status").eq("clinic_id", clinicId),
      supabase.from("email_send_state").select("sent_today").eq("clinic_id", clinicId).maybeSingle(),
      supabase.from("clinics").select("settings").eq("id", clinicId).maybeSingle(),
    ]);
    setLogs((ls ?? []) as any);
    setQueue((q ?? []) as any);
    setSentToday((state as any)?.sent_today ?? 0);
    setQuota(Number((c as any)?.settings?.email?.quota_daily ?? 1000));
    setLastUpdate(new Date());
    setLoading(false);
  }

  useEffect(() => {
    if (clinicId) load();
  }, [clinicId, range.id]);

  useEffect(() => {
    document.title = "Email — Dashboard";
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    if (!clinicId) return;
    const ch = supabase
      .channel(`email-dash-${clinicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_logs" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_queue", filter: `clinic_id=eq.${clinicId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [clinicId, range.id]);

  // Métricas agregadas (precisas para janelas longas, sem teto de 1000 linhas)
  const metricsDays = Math.max(1, Math.ceil(range.hours / 24));
  const { rows: metricRows } = useEmailMetrics(clinicId, metricsDays);
  const useAggregated = range.hours > 24;

  const stats = useMemo(() => {
    if (useAggregated) {
      const a = aggregateMetrics(metricRows);
      const failedAgg = a.failed + a.bounced + a.complained;
      const pendingDelivery = Math.max(0, a.sent - a.delivered - failedAgg);
      return {
        total: a.sent,
        delivered: a.delivered,
        pendingDelivery,
        opened: a.opened,
        clicked: a.clicked,
        failed: failedAgg,
        deliveredPct: a.deliveredPct,
        openPct: a.openPct,
        clickPct: a.clickPct,
        failedPct: a.failedPct,
      };
    }
    const total = logs.length;
    const delivered = logs.filter((l) => !!l.delivered_at || l.status === "delivered" || l.opened_at || l.clicked_at).length;
    const opened = logs.filter((l) => l.opened_at).length;
    const clicked = logs.filter((l) => l.clicked_at).length;
    const failed = logs.filter((l) => ["failed", "bounced", "complained"].includes(l.status)).length;
    const pendingDelivery = Math.max(0, total - delivered - failed);
    return {
      total,
      delivered,
      pendingDelivery,
      opened,
      clicked,
      failed,
      deliveredPct: total ? Math.round((delivered / total) * 100) : 0,
      openPct: total ? Math.round((opened / total) * 100) : 0,
      clickPct: total ? Math.round((clicked / total) * 100) : 0,
      failedPct: total ? Math.round((failed / total) * 100) : 0,
    };
  }, [logs, useAggregated, metricRows]);

  const queueStats = useMemo(() => {
    const m: Record<string, number> = { pending: 0, processing: 0, failed: 0, sent: 0, cancelled: 0 };
    for (const r of queue) m[r.status] = (m[r.status] ?? 0) + 1;
    return m;
  }, [queue]);

  const templates = useMemo(() => {
    const set = new Set(logs.map((l) => l.template_slug).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (templateFilter !== "all" && l.template_slug !== templateFilter) return false;
      if (search && !l.recipient_email.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, statusFilter, templateFilter, search]);

  // Time series (envios/dia ou /hora). Usa agregação quando disponível.
  const timeSeries = useMemo(() => {
    const isHourly = range.hours <= 24;
    const buckets = new Map<string, { key: string; sent: number; opened: number; clicked: number; failed: number }>();
    const fmt = (d: Date) =>
      isHourly
        ? `${String(d.getHours()).padStart(2, "0")}:00`
        : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

    const now = new Date();
    const steps = isHourly ? 24 : Math.min(90, Math.ceil(range.hours / 24));
    for (let i = steps - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * (isHourly ? 3600_000 : 86400_000));
      const k = fmt(d);
      buckets.set(k, { key: k, sent: 0, opened: 0, clicked: 0, failed: 0 });
    }

    if (useAggregated) {
      for (const r of metricRows) {
        const b = buckets.get(r.day);
        if (!b) continue;
        b.sent += r.sent;
        b.opened += r.opened;
        b.clicked += r.clicked;
        b.failed += r.failed + r.bounced + r.complained;
      }
    } else {
      for (const l of logs) {
        const d = new Date(l.sent_at);
        const k = fmt(d);
        const b = buckets.get(k);
        if (!b) continue;
        b.sent++;
        if (l.opened_at) b.opened++;
        if (l.clicked_at) b.clicked++;
        if (["failed", "bounced", "complained"].includes(l.status)) b.failed++;
      }
    }
    return Array.from(buckets.values());
  }, [logs, range.hours, useAggregated, metricRows]);

  // Top templates
  const byTemplate = useMemo(() => {
    const m = new Map<string, number>();
    if (useAggregated) {
      for (const r of metricRows) {
        const k = r.template_slug || "(sem template)";
        m.set(k, (m.get(k) ?? 0) + r.sent);
      }
    } else {
      for (const l of logs) {
        const k = l.template_slug ?? "(sem template)";
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [logs, useAggregated, metricRows]);

  // Status pie
  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) {
      const effective = l.clicked_at ? "clicked" : l.opened_at ? "opened" : l.status;
      m.set(effective, (m.get(effective) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [logs]);

  const quotaPct = quota > 0 ? Math.round((sentToday / quota) * 100) : 0;

  const chartConfig = {
    sent: { label: "Entregues", color: "hsl(var(--primary))" },
    opened: { label: "Abertos", color: "hsl(142 71% 45%)" },
    clicked: { label: "Cliques", color: "hsl(262 83% 58%)" },
    failed: { label: "Falhas", color: "hsl(var(--destructive))" },
    count: { label: "Entregues", color: "hsl(var(--primary))" },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Email Marketing</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Activity className="h-3 w-3" />
            Atualizado em tempo real • {lastUpdate.toLocaleTimeString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-md border p-1 text-xs">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r)}
                className={`rounded px-3 py-1 transition ${
                  range.id === r.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3 w-3" />Entregues</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.total.toLocaleString("pt-BR")}</div>
          <div className="text-xs text-muted-foreground">no período</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3 w-3" />Falhas</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.failedPct}%</div>
          <div className="text-xs text-muted-foreground">{stats.failed.toLocaleString("pt-BR")} no período</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Eye className="h-3 w-3" />Abertura</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.openPct}%</div>
          <div className="text-xs text-muted-foreground">{stats.opened.toLocaleString("pt-BR")} aberturas</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><MousePointerClick className="h-3 w-3" />Cliques</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.clickPct}%</div>
          <div className="text-xs text-muted-foreground">{stats.clicked.toLocaleString("pt-BR")} cliques</div>
        </Card>
      </div>

      {/* Time-series chart */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Atividade ao longo do tempo</div>
          <div className="text-xs text-muted-foreground">{range.label}</div>
        </div>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart data={timeSeries}>
            <defs>
              <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gOpened" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gClicked" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(262 83% 58%)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(262 83% 58%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="key" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey="sent" stroke="hsl(var(--primary))" fill="url(#gSent)" strokeWidth={2} />
            <Area type="monotone" dataKey="opened" stroke="hsl(142 71% 45%)" fill="url(#gOpened)" strokeWidth={2} />
            <Area type="monotone" dataKey="clicked" stroke="hsl(262 83% 58%)" fill="url(#gClicked)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </Card>

      {/* E-2: Saúde de envio + domínios */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <DomainHealthCard clinicId={clinicId} />
        </div>
        {/* Funil isolado pra dar destaque */}
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Funil ({range.label})</div>
          <div className="space-y-2">
            {[
              { label: "Entregues", n: stats.total, pct: 100, color: "bg-primary" },
              { label: "Abertos", n: stats.opened, pct: stats.openPct, color: "bg-emerald-500" },
              { label: "Clicaram", n: stats.clicked, pct: stats.clickPct, color: "bg-violet-500" },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="tabular-nums">{s.n} · {s.pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${s.color}`} style={{ width: `${Math.min(100, s.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">


        {/* Status pie */}
        <Card className="p-4 md:col-span-1">
          <div className="text-sm font-semibold mb-3">Distribuição de status</div>
          {byStatus.length === 0 ? (
            <div className="text-xs text-muted-foreground h-[180px] flex items-center justify-center">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {byStatus.map((d, i) => (
                    <Cell key={i} fill={STATUS_COLORS[d.name] ?? `hsl(${(i * 60) % 360} 60% 55%)`} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-2 text-[11px] mt-2">
            {byStatus.map((d, i) => (
              <span key={i} className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: STATUS_COLORS[d.name] ?? `hsl(${(i * 60) % 360} 60% 55%)` }}
                />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </Card>

        {/* Quota + fila */}
        <Card className="p-4 md:col-span-1 space-y-3">
          <div>
            <div className="text-sm font-semibold">Cota diária</div>
            <div className="text-xs text-muted-foreground">{sentToday} / {quota} envios hoje</div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden mt-1">
              <div
                className={`h-full ${quotaPct > 90 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${Math.min(100, quotaPct)}%` }}
              />
            </div>
          </div>
          <div className="pt-2 border-t">
            <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Clock className="h-3 w-3" />Fila</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-muted/50 p-2">
                <div className="text-muted-foreground">Pendentes</div>
                <div className="text-lg font-semibold tabular-nums">{queueStats.pending ?? 0}</div>
              </div>
              <div className="rounded bg-muted/50 p-2">
                <div className="text-muted-foreground">Falhas</div>
                <div className="text-lg font-semibold tabular-nums text-destructive">{queueStats.failed ?? 0}</div>
              </div>
            </div>
          </div>
          {stats.failed > 0 && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />{stats.failed} envios com falha no período
            </div>
          )}
        </Card>
      </div>

      {/* Top templates */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Top templates</div>
        {byTemplate.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Sem dados</div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart data={byTemplate} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={140} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </Card>

      {/* Recent logs */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold mr-2">Últimos envios</div>
          <Input
            placeholder="Buscar destinatário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="sent">Entregue</SelectItem>
              <SelectItem value="opened">Aberto</SelectItem>
              <SelectItem value="clicked">Clicado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="bounced">Bounce</SelectItem>
            </SelectContent>
          </Select>
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos templates</SelectItem>
              {templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum envio</TableCell></TableRow>
              )}
              {filtered.slice(0, 50).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.template_slug ?? "—"}</TableCell>
                  <TableCell className="text-xs">{l.recipient_email}</TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate">{l.subject}</TableCell>
                  <TableCell>{statusBadge(l.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(l.sent_at).toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
